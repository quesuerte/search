import React, { useState } from 'react';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import { backendSearch } from '../api/api';

function SearchPage() {
  const [keywordResults, setkeywordResults] = useState([]);
  const [semanticResults, setsemanticResults] = useState([]);
  const [loadingKeyword, setloadingKeyword] = useState(false);
  const [loadingSemantic, setloadingSemantic] = useState(false);
  const [ErrorKeyword, setErrorKeyword] = useState(null);
  const [ErrorSemantic, setErrorSemantic] = useState(null);
  const [firstLoad, setFirstLoad] = useState(true);

  const handleSearch = async (searchTerm) => {
    setFirstLoad(false);
    setkeywordResults([]);
    setsemanticResults([]);
    setErrorKeyword(null);
    setErrorSemantic(null);
    setloadingKeyword(true);
    setloadingSemantic(true);
    // Start primary search
    backendSearch(searchTerm, false)
      .then(res => setkeywordResults(res.results || []))
      .catch(err => {
        console.error('Keyword search error:', err);
        setErrorKeyword('Keyword search failed.');
      })
      .finally(() => setloadingKeyword(false));

    // Start secondary search
    backendSearch(searchTerm, true)
      .then(res => setsemanticResults(res.results || []))
      .catch(err => {
        console.error('Semantic search error:', err);
        setErrorSemantic('Semantic search failed.');
      })
      .finally(() => setloadingSemantic(false));
  };

  return (
    <div className="search-page">
      <SearchBar onSearch={handleSearch} />

      <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', width: '100%', marginTop: '20px' }}>
        <div style={{ flex: '1', minWidth: '0' }}>
          {loadingKeyword && <div className="loading">Loading results...</div>}
          {ErrorKeyword && <div className="error-message">{ErrorKeyword}</div>}
          {!loadingKeyword && !ErrorKeyword && !firstLoad && keywordResults.length === 0 && (
            <div className="no-results">No keyword results found.</div>
          )}
          {!loadingKeyword && keywordResults.length > 0 && (
            <SearchResults results={keywordResults} isSemantic={false} />
          )}
        </div>

        <div style={{ flex: '1', minWidth: '0' }}>
          {loadingSemantic && <div className="loading">Loading results...</div>}
          {ErrorSemantic && <div className="error-message">{ErrorSemantic}</div>}
          {!loadingSemantic && !ErrorSemantic && !firstLoad && semanticResults.length === 0 && (
            <div className="no-results">No semantic results found.</div>
          )}
          {!loadingSemantic && semanticResults.length > 0 && (
            <SearchResults results={semanticResults} isSemantic={true} />
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchPage;