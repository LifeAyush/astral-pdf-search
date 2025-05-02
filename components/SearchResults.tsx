'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DocumentTextIcon, ArrowTopRightOnSquareIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { SearchResult, PageRange } from '@/types/index';

/**
 * Props for the SearchResults component
 */
interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

/**
 * Displays search results as a grid of cards with PDF previews
 * @param results The search results to display
 * @param isLoading Whether the search is loading
 * @returns A component displaying the search results
 */
export default function SearchResults({ results, isLoading }: SearchResultsProps) {
  // State hooks
  const [printing, setPrinting] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  /**
   * Calculates the average relevance score for a search result
   * @param result The search result to calculate the score for
   * @returns The average score or -1 if no relevant pages or only page 1
   */
  const calculateAverageScore = (result: SearchResult): number => {
    if (!result.relevant_pages || result.relevant_pages.length === 0) return -1;
    
    // Check if only page 1 is relevant (less accurate)
    const isPageOneOnly = result.relevant_pages.every(range => range.start === 1 && range.end === 1);
    if (isPageOneOnly) return -1;
    
    const sum = result.relevant_pages.reduce((sum, page) => sum + (page.score || 0), 0);
    return sum / result.relevant_pages.length;
  };
  
  /**
   * Sorts results by relevance score
   */
  const sortedResults = [...results].sort((a, b) => {
    const scoreA = calculateAverageScore(a);
    const scoreB = calculateAverageScore(b);
    return scoreB - scoreA;
  });

  /**
   * Calculates a percentage relevance display for a result
   * @param result The search result to calculate relevance for
   * @returns A string representation of relevance
   */
  const getRelevancePercentage = (result: SearchResult): string => {
    if (!result.relevant_pages || result.relevant_pages.length === 0) return 'Less Relevant';
    
    // Check if only page 1 is relevant (less accurate)
    const isPageOneOnly = result.relevant_pages.every(range => range.start === 1 && range.end === 1);
    if (isPageOneOnly) return 'Less Relevant';
    
    const scores = result.relevant_pages.map(page => page.score || 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const maxPossibleScore = 10; // Assumption based on scoring system
    
    return `${Math.min(Math.round((averageScore / maxPossibleScore) * 100), 100)}% Relevant`;
  };

  /**
   * Formats page ranges for display
   * @param ranges The page ranges to format
   * @returns A formatted string of page ranges
   */
  const formatPageRange = (ranges: PageRange[] | null): string => {
    if (!ranges || ranges.length === 0) return 'Unknown';
    
    // Sort ranges by start page
    const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
    
    // Merge contiguous ranges
    const mergedRanges: PageRange[] = [];
    let currentRange = sortedRanges[0];
    
    for (let i = 1; i < sortedRanges.length; i++) {
      const nextRange = sortedRanges[i];
      
      // Check if ranges are contiguous
      if (currentRange.end + 1 >= nextRange.start) {
        // Merge ranges by extending the end of current range
        currentRange.end = Math.max(currentRange.end, nextRange.end);
      } else {
        // Ranges are not contiguous, add current range and start new one
        mergedRanges.push(currentRange);
        currentRange = nextRange;
      }
    }
    
    // Add the last range
    mergedRanges.push(currentRange);
    
    // Format the merged ranges
    return mergedRanges.map(range => `${range.start}-${range.end}`).join(', ');
  };
  
  /**
   * Handles printing specific pages of a PDF
   * @param result The search result to print
   */
  const handlePrint = async (result: SearchResult): Promise<void> => {
    if (!result.relevant_pages || printing[result.id]) return;
    
    try {
      setPrinting(prev => ({ ...prev, [result.id]: true }));
      
      const response = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfUrl: result.url,
          pages: result.relevant_pages
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate printable PDF');
      }
      
      // Create a blob from the PDF stream
      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open PDF in a new tab for printing
      const printWindow = window.open(pdfUrl, '_blank');
      
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print. Please try again.');
    } finally {
      setPrinting(prev => ({ ...prev, [result.id]: false }));
    }
  };
  
  /**
   * Handles image load errors
   * @param resultId The ID of the result with the failing image
   */
  const handleImageError = (resultId: string): void => {
    setImageErrors(prev => ({ ...prev, [resultId]: true }));
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Searching for relevant PDFs...</p>
      </div>
    );
  }
  
  // Render empty state
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">No results</h3>
        <p className="mt-1 text-gray-500">Try a different search query.</p>
      </div>
    );
  }
  
  // Render results
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{sortedResults.length} Results</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedResults.map((result) => (
          <div 
            key={result.id}
            className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Preview Image with Score Badge */}
            <div className="relative h-48 bg-gray-100">
              {result.relevant_pages && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded-md text-sm font-medium">
                  {getRelevancePercentage(result)}
                </div>
              )}
              {result.status === 'processing' ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-sm text-gray-600">Processing PDF...</span>
                </div>
              ) : result.preview_image_url && !imageErrors[result.id] ? (
                result.preview_image_url.startsWith('/') ? (
                  <Image
                    src={result.preview_image_url}
                    alt="PDF Document"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    onError={() => handleImageError(result.id)}
                  />
                ) : (
                  <img
                    src={result.preview_image_url}
                    alt="PDF Document"
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(result.id)}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <DocumentTextIcon className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>
            
            {/* Result Details */}
            <div className="p-4">
              <h3 className="font-medium text-lg mb-1 line-clamp-2">{result.title}</h3>
              
              {result.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{result.description}</p>
              )}
              
              <div className="flex flex-col space-y-2 text-sm">
                {result.total_pages !== undefined && (
                  <p>
                    <span className="font-medium">Total Pages:</span> {result.total_pages || 1}
                  </p>
                )}
                
                {result.relevant_pages && result.relevant_pages.length > 0 && (
                  <div>
                    <span className="font-medium">Relevant Pages: {formatPageRange(result.relevant_pages)}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex space-x-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
                  Open PDF
                </a>
                
                {result.relevant_pages && (
                  <button
                    onClick={() => handlePrint(result)}
                    disabled={printing[result.id] || result.status === 'processing'}
                    className={`flex items-center px-3 py-1.5 text-sm rounded-md ${
                      printing[result.id] || result.status === 'processing'
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <PrinterIcon className="h-4 w-4 mr-1" />
                    {printing[result.id] ? 'Preparing...' : 'Print Pages'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}