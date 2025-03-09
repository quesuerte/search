import React, { useState } from 'react';
import '../App.css'

function SearchBar({ onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm);
    }
  };

  return (
    <form id="search-form" className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        id="search-input"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search for documents..."
        className="search-input"
      />
      <button type="submit" id="search-button" className="search-button">
        Search
      </button>
    </form>
  );
}

export default SearchBar;