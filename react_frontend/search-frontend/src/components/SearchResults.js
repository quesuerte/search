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
  const docKey = (id, page) => {
    return `${id}:${page}`;
  }
  const parseAuthors = (authors) => {
    const expr = /\s*([^()]+)\s*\(([^)]+)\)\s*/g;
    const authorMatches = [...authors.matchAll(expr)];
    
    if (authorMatches.length === 0) {
      return (<ul><li>No authors available</li></ul>);
    }
    
    return (
      <ul>
        {authorMatches.map((match, index) => (
          <li key={index}><a style={{color: '#4a90e2' }} href={match[2]}>{match[1]}</a></li>
        ))}
      </ul>
    );
  }

  return (
    <div className="results-list">
      <h2 className="text-lg font-semibold mb-4">
        {isSemantic ? 'Semantic' : 'Keyword'} Search Results
      </h2>
      <ul className="results-list">
        {results.map((doc) => {
          const isExpanded = expandedIds.has(docKey(doc.id,doc.page));
          const title = doc.title;
          return (
              <li key={doc.id} className="result-item">
                {/* Left: Title + Page */}
                <div className="header-row">
                  <Link to={{pathname: `/pdf/${doc.id}`, hash: `page=${doc.page + 1}`, state: title }} className="result-link">
                    <h3 className="doc-title">{title}</h3>
                    <p>Page: {doc.page + 1}</p>
                  </Link>

                  <div>
                    <button
                      className="search-button"
                      style={{ padding: '6px 12px', marginBottom: isExpanded ? '10px' : 0 }}
                      onClick={() => toggleExpand(docKey(doc.id,doc.page))}
                    >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                </div>
              
              {isExpanded && (
                <div className="expanded-content">
                  <div className="expand-left">
                  <p><strong>Authors:</strong> {parseAuthors(doc.author)}</p>
                  </div>
                  {doc.summary && (
                    <div className="expand-right">
                    <p><strong>Summary:</strong><br/> {doc.summary}</p>
                    </div>
                  )}
                </div>
              )}
              </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SearchResults;