import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

// Type definitions
type SearchResult = {
  // Define properties based on search_results table schema
  id: string;
  search_id: string;
  [key: string]: any; // Additional fields from the search_results table
};

type Search = {
  query: string;
};

type ApiResponse = {
  searchId?: string;
  query?: string;
  results?: SearchResult[];
  error?: string;
};

// Validate environment variables
const validateEnv = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables');
  }

  return { supabaseUrl, supabaseServiceKey };
};

// Initialize Supabase client
const { supabaseUrl, supabaseServiceKey } = validateEnv();
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

/**
 * Retrieves the search query for a given search ID
 * @param searchId The ID of the search to retrieve
 * @returns The search query or null if not found
 */
const getSearchById = async (searchId: string): Promise<Search | null> => {
  const { data, error } = await supabase
    .from('searches')
    .select('query')
    .eq('id', searchId)
    .single();
  
  if (error) {
    throw new Error(`Failed to retrieve search: ${error.message}`);
  }
  
  return data;
};

/**
 * Retrieves all search results for a given search ID
 * @param searchId The ID of the search to retrieve results for
 * @returns An array of search results
 */
const getSearchResults = async (searchId: string): Promise<SearchResult[]> => {
  const { data, error } = await supabase
    .from('search_results')
    .select('*')
    .eq('search_id', searchId);
  
  if (error) {
    throw new Error(`Failed to retrieve search results: ${error.message}`);
  }
  
  return data || [];
};

/**
 * GET handler for retrieving search results by search ID
 * @param request The incoming request
 * @param params The route parameters containing the search ID
 * @returns NextResponse containing either the search data and results or an error message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ApiResponse>> {
  try {
    const searchId = params.id;
    
    if (!searchId) {
      return NextResponse.json(
        { error: 'Search ID is required' },
        { status: 400 }
      );
    }
    
    // Get the search query
    const search = await getSearchById(searchId);
    
    if (!search) {
      return NextResponse.json(
        { error: 'Search not found' },
        { status: 404 }
      );
    }
    
    // Get all results for this search
    const results = await getSearchResults(searchId);
    
    return NextResponse.json({
      searchId,
      query: search.query,
      results
    });
  } catch (error: any) {
    console.error('Results API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve search results' },
      { status: 500 }
    );
  }
}