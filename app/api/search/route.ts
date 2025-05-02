import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Database } from '@/types/supabase';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import fetch from 'node-fetch';
import { fromBuffer } from 'pdf2pic';
import { mkdir } from 'fs/promises';

// Set max duration to 60 seconds (for Vercel's Edge functions)
export const maxDuration = 60;

// Type definitions
type SearchRequest = {
  query: string;
};

type PdfPage = {
  page: number;
  text: string;
};

type ScoredPage = {
  page: number;
  snippet: string;
  score: number;
};

type SearchResult = {
  id?: string;
  search_id: string;
  url: string;
  title: string;
  description: string;
  total_pages: number;
  relevant_pages: Array<{
    start: number;
    end: number;
    score?: number;
    snippet?: string;
  }>;
  preview_image_url: string | null;
  cached_at?: string;
};

type ApiResponse = {
  searchId?: string;
  results?: SearchResult[];
  message?: string;
  isCached?: boolean;
  error?: string;
};

// Validate environment variables
const validateEnv = () => {
  const requiredVars = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleCseId: process.env.GOOGLE_CSE_ID
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return {
    supabaseUrl: requiredVars.supabaseUrl!,
    supabaseServiceKey: requiredVars.supabaseServiceKey!,
    googleApiKey: requiredVars.googleApiKey!,
    googleCseId: requiredVars.googleCseId!
  };
};

// Initialize clients
const { supabaseUrl, supabaseServiceKey, googleApiKey, googleCseId } = validateEnv();
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
const customSearch = google.customsearch('v1');

/**
 * Extract text from PDF pages
 * @param buffer PDF buffer
 * @returns Array of pages with text content
 */
async function extractPages(buffer: Buffer): Promise<PdfPage[]> {
  try {
    const pdfData = await pdfParse(buffer);
    const pages: PdfPage[] = [];
    
    if (!pdfData.text) {
      throw new Error('Failed to extract text from PDF');
    }
    
    // Get the total number of pages from the PDF info
    const totalPages = pdfData.numpages || 
                      (pdfData.info && pdfData.info.Pages ? parseInt(pdfData.info.Pages) : 0);
    
    // Extract text from each page
    for (let i = 0; i < totalPages; i++) {
      const pageData = await pdfParse(buffer, { max: i + 1 });
      const text = pageData.text?.trim();
      if (text) { // Only add pages that have content
        pages.push({ page: i + 1, text });
      }
    }
    
    return pages;
  } catch (error) {
    console.error('Error extracting PDF pages:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Score a page based on query relevance
 * @param text Page text content
 * @param query Search query
 * @returns Relevance score (0-10)
 */
function scorePage(text: string, query: string): number {
  const qWords = query.toLowerCase().split(/\s+/);
  const pageText = text.toLowerCase();
  
  // Calculate word frequency and presence
  const wordScores = qWords.map(word => {
    const wordCount = (pageText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
    return wordCount * 2; // Each occurrence counts as 2 points
  });
  
  // Calculate total score (max 10 points)
  const totalScore = wordScores.reduce((sum, score) => sum + score, 0);
  return Math.min(totalScore, 10); // Cap at 10 points
}

/**
 * Find the most relevant pages in a PDF
 * @param pdfUrl URL of the PDF
 * @param query Search query
 * @returns Array of scored pages
 */
async function findRelevantPages(pdfUrl: string, query: string): Promise<ScoredPage[]> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const pages = await extractPages(buffer);

    // Limit to first 10 pages for performance
    const pagesToProcess = pages.slice(0, 10);

    const scored = pagesToProcess.map(p => {
      const score = scorePage(p.text, query);
      return {
        page: p.page,
        snippet: p.text.slice(0, 300),
        score: score
      };
    });

    // Sort by score and get top 5 pages
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .filter(page => page.score > 0); // Only include pages with non-zero scores
  } catch (error) {
    console.error('Error finding relevant pages:', error);
    throw new Error('Failed to analyze PDF for relevant pages');
  }
}

/**
 * Check for existing search results in database
 * @param query Search query
 * @returns Search ID and cached results if found
 */
async function checkCachedResults(query: string): Promise<{ searchId: string, results: SearchResult[] } | null> {
  try {
    const { data: existingSearch } = await supabase
      .from('searches')
      .select('id')
      .eq('query', query)
      .single();

    if (!existingSearch) {
      return null;
    }

    const { data: cachedResults } = await supabase
      .from('search_results')
      .select('*')
      .eq('search_id', existingSearch.id)
      .order('cached_at', { ascending: false });

    if (!cachedResults || cachedResults.length === 0) {
      return null;
    }

    return {
      searchId: existingSearch.id,
      results: cachedResults as SearchResult[]
    };
  } catch (error) {
    console.error('Error checking cached results:', error);
    return null;
  }
}

/**
 * Create or update a search record
 * @param query Search query
 * @returns Search ID
 */
async function createSearch(query: string): Promise<string> {
  const { data, error } = await supabase
    .from('searches')
    .upsert({ query })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create search record: ${error.message}`);
  }

  return data.id;
}

/**
 * Process a PDF to extract relevant information and generate preview
 * @param pdfUrl URL of the PDF
 * @param resultId ID of the search result
 * @param searchId ID of the search
 * @param query Search query
 */
async function processPdf(pdfUrl: string, resultId: string, searchId: string, query: string): Promise<void> {
  try {
    // Fetch the PDF file
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    // Get the PDF as buffer
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    
    // Parse the PDF to get total pages
    const pdfData = await pdfParse(pdfBuffer);
    
    // Calculate total pages
    const totalPages = pdfData.numpages || 
                      (pdfData.info && pdfData.info.Pages ? parseInt(pdfData.info.Pages) : 0);
    
    // Find the most relevant pages
    const relevantPages = await findRelevantPages(pdfUrl, query);

    // Generate preview image configuration
    const options = {
      density: 100,
      saveFilename: resultId,
      savePath: './public/previews',
      format: 'png',
      width: 600,
      height: 800
    };

    // Ensure previews directory exists
    await mkdir('./public/previews', { recursive: true });

    // Convert first page to image
    const convert = fromBuffer(pdfBuffer, options);
    const pageToConvert = 1;
    const previewPath = await convert(pageToConvert, { responseType: 'base64' });
    
    // Save the preview image
    const previewImagePath = `previews/${resultId}.${options.format}`;
    const previewImageUrl = `/${previewImagePath}`;
    
    // Update the search result with the total pages, relevant pages info, and preview image
    const { error: updateError } = await supabase
      .from('search_results')
      .update({
        preview_image_url: previewImageUrl,
        total_pages: totalPages,
        relevant_pages: relevantPages.map(page => ({
          start: page.page,
          end: page.page,
          score: page.score,
          snippet: page.snippet
        }))
      })
      .eq('id', resultId);
    
    if (updateError) {
      throw new Error(`Error updating search result: ${updateError.message}`);
    }
  } catch (error) {
    console.error('PDF processing error:', error);
    
    // Update the result with error status
    await supabase
      .from('search_results')
      .update({
        description: `Error processing PDF: ${error instanceof Error ? error.message : String(error)}`
      })
      .eq('id', resultId);
  }
}

/**
 * Perform a Google search for PDF files
 * @param formattedQuery Search query with PDF filetype
 * @param searchId ID of the search
 * @returns Array of processed search results
 */
async function performGoogleSearch(formattedQuery: string, searchId: string): Promise<SearchResult[]> {
  try {
    const searchResponse = await customSearch.cse.list({
      auth: googleApiKey,
      cx: googleCseId,
      q: formattedQuery,
      fileType: 'pdf',
      num: 10 // Number of results to return
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    // Process each search result
    const processedResults = await Promise.all(
      searchResponse.data.items.map(async (item) => {
        try {
          if (!item.link) {
            return null;
          }
          
          // Extract basic metadata
          const result: SearchResult = {
            search_id: searchId,
            url: item.link,
            title: item.title || 'Untitled PDF',
            description: item.snippet || '',
            total_pages: 0,
            relevant_pages: [{ start: 1, end: 1 }],
            preview_image_url: item.pagemap?.cse_thumbnail?.[0]?.src || null
          };

          // Store initial result in database
          const { data: storedResult, error: resultError } = await supabase
            .from('search_results')
            .upsert(result)
            .select('id')
            .single();

          if (resultError) {
            console.error('Error storing result:', resultError);
            return null;
          }

          // Start processing the PDF in the background with the query
          processPdf(item.link, storedResult.id, searchId, formattedQuery.replace(' filetype:pdf', '')).catch(console.error);

          return {
            ...result,
            id: storedResult.id
          };
        } catch (error) {
          console.error('Error processing search result:', error);
          return null;
        }
      })
    );

    // Filter out null results
    return processedResults.filter(Boolean) as SearchResult[];
  } catch (error) {
    console.error('Google search error:', error);
    throw new Error('Failed to perform Google search');
  }
}

/**
 * POST handler for searching PDFs
 * @param request The incoming request with search query
 * @returns NextResponse containing either the search results or an error message
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  try {
    const { query } = await request.json() as SearchRequest;
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Format query with "filetype:pdf" if not already included
    const formattedQuery = query.toLowerCase().includes('filetype:pdf') 
      ? query 
      : `${query} filetype:pdf`;

    // Check for cached results
    const cachedData = await checkCachedResults(query);
    
    if (cachedData) {
      return NextResponse.json({
        searchId: cachedData.searchId,
        results: cachedData.results,
        isCached: true
      });
    }

    // Create a new search entry
    const searchId = await createSearch(query);

    // Perform Google search
    const results = await performGoogleSearch(formattedQuery, searchId);

    if (results.length === 0) {
      return NextResponse.json({
        searchId,
        results: [],
        message: 'No PDF results found for this query'
      });
    }

    return NextResponse.json({
      searchId,
      results,
      isCached: false
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to perform PDF search' },
      { status: 500 }
    );
  }
}