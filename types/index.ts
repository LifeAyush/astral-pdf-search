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
  score?: number
  snippet?: string
}