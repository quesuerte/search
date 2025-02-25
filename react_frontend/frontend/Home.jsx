import React, { useState, useEffect, useRef } from "react";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState([]);
  const [keywordResults, setKeywordResults] = useState([]);
  const searchInputRef = useRef(null);

  // Mock Data
  const data = [
    { id: 1, title: "React Basics", content: "Learn React from scratch." },
    { id: 2, title: "Advanced SQL", content: "Optimize SQL queries effectively." },
    { id: 3, title: "Egglog Guide", content: "How to use Egglog for data analysis." },
    { id: 4, title: "SQLGlot Overview", content: "A deep dive into SQLGlot parsing." },
  ];

  // Mock keyword search
  const keywordSearch = (query) => {
    if (!query) return [];
    return data.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.content.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Mock semantic search (placeholder)
  const semanticSearch = (query) => {
    if (!query) return [];
    return data
      .map((item) => ({
        ...item,
        score: Math.random(), // Replace with actual ML model score
      }))
      .sort((a, b) => b.score - a.score);
  };

  useEffect(() => {
    setKeywordResults(keywordSearch(query));
    setSemanticResults(semanticSearch(query));
  }, [query]);

  // Hotkey to focus the search bar
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current.focus();
      }
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div className="p-4">
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      />

      <div className="grid grid-cols-2 gap-4">
        {/* Semantic Search Results */}
        <div>
          <h2 className="text-xl font-bold mb-2">Semantic Search</h2>
          {semanticResults.map((item) => (
            <div key={item.id} className="p-2 border-b">
              <strong>{item.title}</strong>
              <p>{item.content}</p>
            </div>
          ))}
        </div>

        {/* Keyword Search Results */}
        <div>
          <h2 className="text-xl font-bold mb-2">Keyword Search</h2>
          {keywordResults.map((item) => (
            <div key={item.id} className="p-2 border-b">
              <strong>{item.title}</strong>
              <p>{item.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
