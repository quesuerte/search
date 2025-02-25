import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SearchPage from './components/SearchPage';
import PDFReader from './components/PDFReader';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1>Document Search & PDF Reader</h1>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/pdf/:documentId" element={<PDFReader />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;