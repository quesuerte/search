import React from 'react';
import { Link } from 'react-router-dom';

function SearchResults({ results }) {
  return (
    <div className="search-results">
      <h2>Search Results</h2>
      <ul className="results-list">
        {results.map((doc) => (
          <li key={doc.id} className="result-item">
            <Link to={`/pdf/${doc.id}`} className="result-link">
              <h3 className="doc-title">{doc.title}</h3>
              <p className="doc-description">{doc.description}</p>
              {doc.matchedText && (
                <p className="match-context">...{doc.matchedText}...</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SearchResults;