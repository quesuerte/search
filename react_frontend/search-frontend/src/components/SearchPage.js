import React, { useState } from 'react';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import { keywordSearch } from '../api/api';

function SearchPage() {
  const [searchResults, setSearchResults] = useState([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  /*const [query, setQuery] = useState(null);*/

  const handleSearch = async (searchTerm) => {
    setFirstLoad(false);
    try {
      /*setQuery(searchTerm);*/
      setIsLoading(true);
      setError(null);
      const results = await keywordSearch(searchTerm);
      setSearchResults(results.results || []);
    } catch (err) {
      setError('Failed to fetch search results. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="search-page">
      <div></div>
      <SearchBar onSearch={handleSearch} />
      
      {isLoading && <div className="loading">Loading results...</div>}
      
      {error && <div className="error-message">{error}</div>}

      {!isLoading && !error && !firstLoad && searchResults.length === 0 && (
        <div className="no-results">
          No documents found. Try a different search term.
        </div>
      )}
      
      {!isLoading && !error && searchResults.length > 0 && (
        <SearchResults results={searchResults} /*query={query}*//>
      )}
    </div>
  );
}

export default SearchPage;