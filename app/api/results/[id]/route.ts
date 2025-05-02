import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;
    
    if (!searchId) {
      return NextResponse.json({ error: 'Search ID is required' }, { status: 400 });
    }
    
    // Get the search query
    const { data: search, error: searchError } = await supabase
      .from('searches')
      .select('query')
      .eq('id', searchId)
      .single();
    
    if (searchError) {
      return NextResponse.json({ error: searchError.message }, { status: 500 });
    }
    
    if (!search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }
    
    // Get all results for this search
    const { data: results, error: resultsError } = await supabase
      .from('search_results')
      .select('*')
      .eq('search_id', searchId);
    
    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 });
    }
    
    return NextResponse.json({
      searchId,
      query: search.query,
      results: results || []
    });
  } catch (error: any) {
    console.error('Results API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}