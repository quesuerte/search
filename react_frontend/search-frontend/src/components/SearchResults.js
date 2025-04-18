import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft } from 'lucide-react';


function SearchResults({results, isSemantic}) {
  // On mobile, control whether we want the search results to be open
  const [isOpen, setIsOpen] = useState(false);

  const toggleIsOpen = () => {
    if (isOpen != null){
      setIsOpen(!isOpen)
    }
  };
  // Once open, this controls whether each item shows the summary/author info
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Set isOpen based on screen width
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
  
      setIsOpen((prev) => {
        if (isDesktop && prev !== null) return null;
        if (!isDesktop && prev === null) return false;
        return prev; // don’t reset if it’s already correct
      });
    };
  
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      {isOpen === null ? (<h2 className="text-lg font-semibold mb-4">
        {isSemantic ? 'Semantic' : 'Keyword'} Search Results
      </h2>) : (
        <button
        onClick={toggleIsOpen}
        style={{
          background: 'none',
          border: 'none',
          justifyContent: 'space-between',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: 'inherit',
          font: 'inherit' 
        }}
      >
        <h2 className="text-lg font-semibold mb-4">
          {isSemantic ? 'Semantic' : 'Keyword'} Search Results
        </h2>
        {isOpen ? <ChevronDown /> : <ChevronLeft />}
      </button>
      )}
      <ul className="results-list" style={{display: isOpen == null || isOpen ? 'block' : 'none'}}>
        {results.map((doc) => {
          const isExpanded = expandedIds.has(docKey(doc.id,doc.page));
          const title = doc.title;
          return (
              <li key={docKey(doc.id,doc.page)} className="result-item">
                {/* Left: Title + Page */}
                <div>
                  <div className="header-row">
                  <Link to={{pathname: `/pdf/${doc.id}`, hash: `page=${doc.page + 1}`}} state={{title: title}} className="result-link">
                    <h3 className="doc-title">{title}</h3>
                  </Link>
                  </div>

                  <div className="header-row">
                    <button
                        className="expand-button"
                        onClick={() => toggleExpand(docKey(doc.id,doc.page))}
                      >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>
                    <p>Page: {doc.page + 1}</p>
                  </div>
                </div>
              
              {isExpanded && (
                <div className="expanded-content">
                  <div className="expand-left">
                  <div style={{textAlign: 'center', paddingBottom: '5px'}}><strong>Authors</strong></div>
                  {parseAuthors(doc.author)}
                  </div>
                  {doc.summary && (
                    <div className="expand-right">
                    <div style={{textAlign: 'center', paddingBottom: '5px'}}><strong>Summary</strong></div>
                    {doc.summary}
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