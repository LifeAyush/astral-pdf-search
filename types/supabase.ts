export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      searches: {
        Row: {
          id: string
          query: string
          created_at: string
        }
        Insert: {
          id?: string
          query: string
          created_at?: string
        }
        Update: {
          id?: string
          query?: string
          created_at?: string
        }
        Relationships: []
      }
      search_results: {
        Row: {
          id: string
          search_id: string
          url: string
          title: string
          description: string | null
          total_pages: number | null
          relevant_pages: Json | null
          preview_image_url: string | null
          cached_at: string
        }
        Insert: {
          id?: string
          search_id: string
          url: string
          title: string
          description?: string | null
          total_pages?: number | null
          relevant_pages?: Json | null
          preview_image_url?: string | null
          cached_at?: string
        }
        Update: {
          id?: string
          search_id?: string
          url?: string
          title?: string
          description?: string | null
          total_pages?: number | null
          relevant_pages?: Json | null
          preview_image_url?: string | null
          cached_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_results_search_id_fkey"
            columns: ["search_id"]
            referencedRelation: "searches"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

// Utility types for the frontend
export interface SearchResult {
  id: string
  search_id: string
  url: string
  title: string
  description: string | null
  total_pages: number | null
  relevant_pages: PageRange[] | null
  preview_image_url: string | null
  cached_at: string
  status?: 'processing' | 'complete' | 'error'
}

export interface PageRange {
  start: number
  end: number
}