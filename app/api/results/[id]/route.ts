import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Database } from '@/types/supabase';

// Type definitions
interface SearchResult {
  id: string;
  search_id: string;
  [key: string]: any;
}

interface ApiResponse {
  searchId?: string;
  query?: string;
  results?: SearchResult[];
  error?: string;
}

// Initialize Supabase
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  params : { params: any }
): Promise<NextResponse<ApiResponse>> {
  try {
    const searchId = params.params.id;

    if (!searchId) {
      return NextResponse.json(
        { error: 'Search ID is required' },
        { status: 400 }
      );
    }

    // Get search query
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .select('query')
      .eq('id', searchId)
      .single();

    if (searchError || !search) {
      return NextResponse.json(
        { error: 'Search not found' },
        { status: 404 }
      );
    }

    // Get search results
    const { data: results } = await supabase
      .from('search_results')
      .select('*')
      .eq('search_id', searchId);

    return NextResponse.json({
      searchId,
      query: search.query,
      results: results || []
    });

  } catch (error: any) {
    console.error('Error fetching search results:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}