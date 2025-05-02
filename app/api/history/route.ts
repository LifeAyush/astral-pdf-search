import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase';

// Type definitions
type SearchHistory = {
  id: string;
  query: string;
  created_at: string;
};

type ApiResponse = {
  searches?: SearchHistory[];
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
 * GET handler for retrieving search history
 * @returns NextResponse containing either the search history or an error message
 */
export async function GET(): Promise<NextResponse<ApiResponse>> {
  try {
    // Get recent search history, limited to 10 entries
    const { data: searches, error } = await supabase
      .from('searches')
      .select('id, query, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch search history' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ searches });
  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}