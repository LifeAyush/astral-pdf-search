'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import SearchResults from '@/components/SearchResults';
import { SearchResult } from '@/types/index';

export default function Home() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<{id: string, query: string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Refs for polling
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Load search history on component mount
  useEffect(() => {
    fetchSearchHistory();
  }, []);
  
  // Check for search ID in URL
  useEffect(() => {
    const searchId = searchParams.get('id');
    if (searchId) {
      fetchResultsById(searchId);
    }
  }, [searchParams]);
  
  // Function to fetch search history
  const fetchSearchHistory = async () => {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      
      if (data.searches) {
        setSearchHistory(data.searches);
      }
    } catch (error) {
      console.error('Error fetching search history:', error);
    }
  };
  
  // Function to fetch results by search ID
  const fetchResultsById = async (searchId: string) => {
    try {
      setIsSearching(true);
      setError(null);
      
      const response = await fetch(`/api/results/${searchId}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setQuery(data.query);
      setSearchResults(data.results);
      setCurrentSearchId(searchId);
      
      // Start polling for updates if any results are still processing
      const hasProcessingResults = data.results.some(
        (result: SearchResult) => result.status === 'processing'
      );
      
      if (hasProcessingResults) {
        startPolling(searchId);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Function to handle search submissions
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      setError(null);
      setSearchResults([]);
      
      // Stop any existing polling
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setSearchResults(data.results);
      setCurrentSearchId(data.searchId);
      
      // Update URL with search ID for shareable links
      router.push(`/?id=${data.searchId}`);
      
      // Refresh search history after new search
      fetchSearchHistory();
      
      // Start polling for updates if not cached and has processing results
      if (!data.isCached) {
        startPolling(data.searchId);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Function to start polling for result updates
  const startPolling = (searchId: string) => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/results/${searchId}`);
        const data = await response.json();
        
        setSearchResults(data.results);
        
        // Check if all results are processed
        const allProcessed = data.results.every(
          (result: SearchResult) => result.status !== 'processing'
        );
        
        if (allProcessed && pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      } catch (error) {
        console.error('Polling error:', error);
        
        // Stop polling on error
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      }
    }, 3000); // Poll every 3 seconds
  };
  
  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);
  
  return (
    <main className="w-full min-h-screen p-4 md:p-8 lg:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">PDF Search</h1>
        
        <SearchBar
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          isSearching={isSearching}
          searchHistory={searchHistory}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          onHistoryItemClick={(item) => {
            setShowHistory(false);
            fetchResultsById(item.id);
          }}
        />
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <SearchResults
          results={searchResults}
          isLoading={isSearching}
        />
      </div>
    </main>
  );
}