import React, { useState } from 'react';
import { Link } from 'react-router-dom';


function SearchResults({results, isSemantic}) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="search-results p-4 mt-6">
      <h2 className="text-lg font-semibold mb-4">
        {isSemantic ? 'Semantic' : 'Keyword'} Search Results
      </h2>
      <ul className="results-list">
        {results.map((doc) => {
          const isExpanded = expandedIds.has(doc.id);
          return (
            <li key={doc.id} className="result-item">
              {/* Left: Title + Page */}
              <Link to={`/pdf/${doc.id}#page=${doc.page + 1}`} className="result-link">
                <h3 className="doc-title">{doc.title}</h3>
                <p className="doc-description">Page: {doc.page + 1}</p>
              </Link>

              {/* Right: Expand Button + Summary (if expanded) */}
              <div className="result-right">
                <button
                  className="search-button"
                  style={{ padding: '6px 12px', marginBottom: isExpanded ? '10px' : 0 }}
                  onClick={() => toggleExpand(doc.id)}
                >
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>

                {isExpanded && (
                  <>
                    <p className="doc-description"><strong>Authors:</strong> {doc.author}</p>
                    {doc.summary && (
                      <p className="match-context">{doc.summary}</p>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SearchResults;