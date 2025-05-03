"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import SearchResults from "@/components/SearchResults";
import { SearchResult } from "@/types/index";

// Type definitions
type HistoryItem = {
  id: string;
  query: string;
};

type SearchResponse = {
  searchId: string;
  results: SearchResult[];
  isCached?: boolean;
  error?: string;
};

type HistoryResponse = {
  searches?: HistoryItem[];
  error?: string;
};

type ResultsResponse = {
  searchId?: string;
  query: string;
  results: SearchResult[];
  error?: string;
};

// Constants
const POLLING_INTERVAL = 3000; // 3 seconds

/**
 * Home page component with PDF search functionality
 * @returns The home page component
 */
export default function Home() {
  // State hooks
  const [query, setQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Navigation hooks
  const router = useRouter();

  // Refs
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetches the search history from the API
   */
  const fetchSearchHistory = async (): Promise<void> => {
    try {
      const response = await fetch("/api/history");
      const data = (await response.json()) as HistoryResponse;

      if (data.searches) {
        setSearchHistory(data.searches);
      }
    } catch (error) {
      console.error("Error fetching search history:", error);
    }
  };

  /**
   * Fetches search results by ID
   * @param searchId The ID of the search to fetch results for
   */
  const fetchResultsById = async (searchId: string): Promise<void> => {
    try {
      setIsSearching(true);
      setError(null);

      const response = await fetch(`/api/results/${searchId}`);
      const data = (await response.json()) as ResultsResponse;

      if (data.error) {
        setError(data.error);
        return;
      }

      setQuery(data.query);
      setSearchResults(data.results);
      setCurrentSearchId(searchId);

      // Start polling for updates if any results are still processing
      const hasProcessingResults = data.results.some(
        (result) => result.status === "processing"
      );

      if (hasProcessingResults) {
        startPolling(searchId);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handles a search submission
   * @param searchQuery The query to search for
   */
  const handleSearch = async (searchQuery: string): Promise<void> => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setError(null);
      setSearchResults([]);

      // Stop any existing polling
      stopPolling();

      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      const data = (await response.json()) as SearchResponse;

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
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Starts polling for result updates
   * @param searchId The ID of the search to poll for
   */
  const startPolling = (searchId: string): void => {
    stopPolling();

    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/results/${searchId}`);
        const data = (await response.json()) as ResultsResponse;

        setSearchResults(data.results);

        // Check if all results are processed
        const allProcessed = data.results?.every(
          (result) => result.status !== "processing"
        );

        if (allProcessed) {
          stopPolling();
        }
      } catch (error) {
        console.error("Polling error:", error);
        stopPolling();
      }
    }, POLLING_INTERVAL);
  };

  /**
   * Stops polling for result updates
   */
  const stopPolling = (): void => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  /**
   * Handles clicking on a history item
   * @param item The history item that was clicked
   */
  const handleHistoryItemClick = (item: HistoryItem): void => {
    setShowHistory(false);
    fetchResultsById(item.id);
  };

  // Effect to load search history on component mount
  useEffect(() => {
    fetchSearchHistory();
  }, []);

  // Effect to check for search ID in URL
  useEffect(() => {
    // Use the built-in window.location to get search params safely
    const urlParams = new URLSearchParams(window.location.search);
    const searchId = urlParams.get("id");
    if (searchId) {
      fetchResultsById(searchId);
    }
  }, []);

  // Effect to clean up polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
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
          onHistoryItemClick={handleHistoryItemClick}
        />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <SearchResults results={searchResults} isLoading={isSearching} />
      </div>
    </main>
  );
}