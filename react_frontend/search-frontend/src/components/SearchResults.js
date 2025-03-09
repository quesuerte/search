import React from 'react';
import { Link } from 'react-router-dom';


function SearchResults({results /*,query*/}) {
  return (
    <div className="search-results">
      <h2>Search Results</h2>
      <ul className="results-list">
        {results.map((doc) => (
          <li key={doc.id} className="result-item">
            <Link to={`/pdf/${doc.id}#page=${doc.page + 1}`} className="result-link">
              <h3 className="doc-title">{doc.title}</h3>
              <p className="doc-description">Authors: {doc.author}</p>
              <p className="doc-description">Page: {doc.page + 1}</p>
              {/*?query=${query}*/}
            </Link>
            {doc.summary && (<div className="result-right">{doc.summary}</div>)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SearchResults;