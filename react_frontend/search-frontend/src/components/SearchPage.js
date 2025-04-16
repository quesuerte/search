import React, { useState } from 'react';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import { backendSearch } from '../api/api';

function SearchPage() {
  const [primaryResults, setPrimaryResults] = useState([]);
  const [secondaryResults, setSecondaryResults] = useState([]);
  const [loadingPrimary, setLoadingPrimary] = useState(false);
  const [loadingSecondary, setLoadingSecondary] = useState(false);
  const [errorPrimary, setErrorPrimary] = useState(null);
  const [errorSecondary, setErrorSecondary] = useState(null);
  const [firstLoad, setFirstLoad] = useState(true);

  const handleSearch = async (searchTerm) => {
    setFirstLoad(false);
    setPrimaryResults([]);
    setSecondaryResults([]);
    setErrorPrimary(null);
    setErrorSecondary(null);
    setLoadingPrimary(true);
    setLoadingSecondary(true);
    // Start primary search
    backendSearch(searchTerm, false)
      .then(res => setPrimaryResults(res.results || []))
      .catch(err => {
        console.error('Primary search error:', err);
        setErrorPrimary('Primary search failed.');
      })
      .finally(() => setLoadingPrimary(false));

    // Start secondary search
    backendSearch(searchTerm, true)
      .then(res => setSecondaryResults(res.results || []))
      .catch(err => {
        console.error('Secondary search error:', err);
        setErrorSecondary('Secondary search failed.');
      })
      .finally(() => setLoadingSecondary(false));
  };

  return (
    <div className="search-page p-4">
      <SearchBar onSearch={handleSearch} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="w-full">
          {loadingPrimary && <div className="loading">Loading results...</div>}
          {errorPrimary && <div className="error-message">{errorPrimary}</div>}
          {!loadingPrimary && !errorPrimary && !firstLoad && primaryResults.length === 0 && (
            <div className="no-results">No primary results found.</div>
          )}
          {!loadingPrimary && primaryResults.length > 0 && (
            <SearchResults results={primaryResults} isSemantic={false} />
          )}
        </div>

        <div className="w-full">
          {loadingSecondary && <div className="loading">Loading results...</div>}
          {errorSecondary && <div className="error-message">{errorSecondary}</div>}
          {!loadingSecondary && !errorSecondary && !firstLoad && secondaryResults.length === 0 && (
            <div className="no-results">No secondary results found.</div>
          )}
          {!loadingSecondary && secondaryResults.length > 0 && (
            <SearchResults results={secondaryResults} isSemantic={true} />
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;