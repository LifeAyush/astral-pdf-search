'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, ClockIcon } from '@heroicons/react/24/outline';

interface SearchHistoryItem {
  id: string;
  query: string;
  created_at?: string;
}

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: (query: string) => void;
  isSearching: boolean;
  searchHistory: SearchHistoryItem[];
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  onHistoryItemClick: (item: SearchHistoryItem) => void;
}

export default function SearchBar({
  query,
  setQuery,
  onSearch,
  isSearching,
  searchHistory,
  showHistory,
  setShowHistory,
  onHistoryItemClick
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  
  // Handle outside clicks to close history dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        historyRef.current && 
        !historyRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowHistory]);
  
  // Handle search submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      setShowHistory(false);
    }
  };

  // Format the date string for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  return (
    <div className="relative mb-8">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setShowHistory(true);
            }}
            placeholder="Search for PDF worksheets, e.g., 'Multiplication 2 digit worksheets'"
            className="w-full py-3 px-12 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-white"
            disabled={isSearching}
          />
          <MagnifyingGlassIcon
            className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </div>
        
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 rounded-full text-white ${
            isSearching || !query.trim()
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {/* Search history dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div
          ref={historyRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto"
        >
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <h3 className="font-medium">Recent Searches</h3>
          </div>
          <ul>
            {searchHistory.map((item) => (
              <li
                key={item.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                onClick={() => onHistoryItemClick(item)}
              >
                <div className="p-3 flex items-start">
                  <ClockIcon className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-medium">{item.query}</span>
                    {item.created_at && (
                      <span className="text-sm text-gray-500">
                        {formatDate(item.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}