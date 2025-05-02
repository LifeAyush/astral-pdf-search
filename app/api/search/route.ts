import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Database } from '@/types/supabase';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import fetch from 'node-fetch';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// Initialize Google Custom Search API
const customSearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID!;

export const maxDuration = 60; // Set max duration to 60 seconds (for Vercel's Edge functions)

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
            preview_image_url: ''
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
          // console.log('Processing PDF:', item);
          // Start processing the PDF in the background
          processPdf(item.link!, storedResult.id, searchId).catch(console.error);

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
async function processPdf(pdfUrl: string, resultId: string, searchId: string) {
  try {
    console.log('Starting PDF processing for URL:', pdfUrl);
    console.log('Result ID:', resultId);
    
    // Fetch the PDF file
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    console.log('Successfully fetched PDF');
    
    // Get the PDF as buffer
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    console.log('PDF buffer size:', pdfBuffer.length);
    
    // Parse the PDF to get total pages
    const pdfData = await pdfParse(pdfBuffer, {
      max: 1, // Only parse the first page for faster processing
    });
    
    console.log('PDF parsed successfully');
    console.log('PDF Data:', {
      numpages: pdfData.numpages,
      info: pdfData.info,
      metadata: pdfData.metadata
    });
    
    // Calculate total pages
    const totalPages = pdfData.numpages || 
                      (pdfData.info && pdfData.info.Pages ? parseInt(pdfData.info.Pages) : 0);
    
    console.log('Calculated total pages:', totalPages);
    
    // Update the search result with the total pages
    const { error: updateError } = await supabase
      .from('search_results')
      .update({
        preview_image_url: pdfUrl,
        total_pages: totalPages
      })
      .eq('id', resultId);
    
    if (updateError) {
      console.error('Error updating database:', updateError);
      throw updateError;
    }
    
    console.log('Successfully updated database with total pages:', totalPages);
    
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