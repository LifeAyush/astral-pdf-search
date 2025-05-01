export type SearchResultType = {
  id: number;
  title: string;
  description: string;
  image: string;
  totalPages: number;
  relevantPages?: {
    startPage: number;
    endPage: number;
  };
}; 