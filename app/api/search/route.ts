import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Database } from '@/types/supabase';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import fetch from 'node-fetch';
import { fromBuffer } from 'pdf2pic';
import { mkdir } from 'fs/promises';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Initialize Google Custom Search API
const customSearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID!;

export const maxDuration = 60; // Set max duration to 60 seconds (for Vercel's Edge functions)

// Function to extract text from PDF pages
async function extractPages(buffer: Buffer) {
  const pdfData = await pdfParse(buffer);
  const pages = [];
  
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
}

// Function to score a page based on query relevance
function scorePage(text: string, query: string) {
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

// Function to find the most relevant pages
async function findRelevantPage(pdfUrl: string, query: string) {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const pages = await extractPages(buffer);

  // Limit to first 10 pages
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
  const topPages = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter(page => page.score > 0); // Only include pages with non-zero scores

  return topPages;
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Format query with "filetype:pdf" if not already included
    const formattedQuery = query.toLowerCase().includes('filetype:pdf') 
      ? query 
      : `${query} filetype:pdf`;

    // Check if search already exists
    const { data: existingSearch } = await supabase
      .from('searches')
      .select('id')
      .eq('query', query)
      .single();

    // If search exists, return cached results
    if (existingSearch) {
      const { data: cachedResults } = await supabase
        .from('search_results')
        .select('*')
        .eq('search_id', existingSearch.id)
        .order('cached_at', { ascending: false });

      if (cachedResults && cachedResults.length > 0) {
        return NextResponse.json({ 
          searchId: existingSearch.id,
          results: cachedResults,
          isCached: true
        });
      }
    }

    // Create a new search entry
    const { data: newSearch, error: searchError } = await supabase
      .from('searches')
      .upsert({ query })
      .select('id')
      .single();

    if (searchError) {
      return NextResponse.json({ error: searchError.message }, { status: 500 });
    }

    const searchId = newSearch.id;

    // Perform Google search
    const searchResponse = await customSearch.cse.list({
      auth: GOOGLE_API_KEY,
      cx: GOOGLE_CSE_ID,
      q: formattedQuery,
      fileType: 'pdf',
      num: 10 // Number of results to return
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return NextResponse.json({ 
        searchId,
        results: [],
        message: 'No PDF results found for this query' 
      });
    }

    // Process each search result
    const processedResults = await Promise.all(
      searchResponse.data.items.map(async (item) => {
        try {
          // Extract basic metadata
          const result = {
            search_id: searchId,
            url: item.link!,
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
          processPdf(item.link!, storedResult.id, searchId, query).catch(console.error);

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

    // Filter out null results and return
    const validResults = processedResults.filter(Boolean);

    return NextResponse.json({
      searchId,
      results: validResults,
      isCached: false
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Process PDF to extract relevant pages and generate preview
async function processPdf(pdfUrl: string, resultId: string, searchId: string, query: string) {
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
    const relevantPages = await findRelevantPage(pdfUrl, query);

    // Generate preview image from first page
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
      console.error('Error updating database:', updateError);
      throw updateError;
    }
  } catch (error) {
    console.error('PDF processing error:', error);
    // Update the result with error status
    const { error: updateError } = await supabase
      .from('search_results')
      .update({
        description: 'Error processing PDF: ' + (error instanceof Error ? error.message : String(error))
      })
      .eq('id', resultId);
      
    if (updateError) {
      console.error('Error updating error status:', updateError);
    }
  }
}