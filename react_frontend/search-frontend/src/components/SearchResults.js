import React from 'react';
import { Link } from 'react-router-dom';

function SearchResults({ results }) {
  return (
    <div className="search-results">
      <h2>Search Results</h2>
      <ul className="results-list">
        {results.map((doc) => (
          <li key={doc.id} className="result-item">
            <Link to={`http://localhost:8000/pdf/${doc.id}#page=${doc.page}`} className="result-link">
              <h3 className="doc-title">{doc.id}</h3>
              <p className="doc-description">Page: {doc.page}</p>
              {/*doc.matchedText && (
                <p className="match-context">...{doc.matchedText}...</p>
              )*/}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SearchResults;