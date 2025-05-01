'use client';

import { useState } from 'react';
import Image from 'next/image';
import { DocumentTextIcon, ArrowTopRightOnSquareIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { SearchResult, PageRange } from '@/types/index';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

export default function SearchResults({ results, isLoading }: SearchResultsProps) {
  const [printing, setPrinting] = useState<Record<string, boolean>>({});
  
  // Handle printing specific pages of a PDF
  const handlePrint = async (result: SearchResult) => {
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
  
  // Format page ranges for display
  const formatPageRange = (ranges: PageRange[] | null) => {
    if (!ranges || ranges.length === 0) return 'Unknown';
    
    return ranges.map(range => {
      if (range.start === range.end) return `Page ${range.start}`;
      return `Pages ${range.start}-${range.end}`;
    }).join(', ');
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Searching for relevant PDFs...</p>
      </div>
    );
  }
  
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">No results</h3>
        <p className="mt-1 text-gray-500">Try a different search query.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{results.length} Results</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results.map((result) => (
          <div 
            key={result.id}
            className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Preview Image */}
            <div className="relative h-48 bg-gray-100">
              {result.status === 'processing' ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-sm text-gray-600">Processing PDF...</span>
                </div>
              ) : result.preview_image_url ? (
                <div className="relative h-full w-full">
                  <Image
                    src={result.preview_image_url}
                    alt={result.title}
                    fill
                    className="object-contain"
                  />
                </div>
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
                {result.total_pages && (
                  <p>
                    <span className="font-medium">Total Pages:</span> {result.total_pages}
                  </p>
                )}
                
                {result.relevant_pages && (
                  <p>
                    <span className="font-medium">Relevant:</span>{' '}
                    {formatPageRange(result.relevant_pages)}
                  </p>
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