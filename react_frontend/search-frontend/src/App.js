import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Lazy load components
const SearchPage = lazy(() => import('./components/SearchPage'));
const PDFReader = lazy(() => import('./components/PDFReader'));

// Loading component
const LoadingFallback = () => <div className="loading">Loading...</div>;

function App() {
  return (
    <Router>
      <div className="glass-panel">
      <div className="app-container">
        <header className="app-header">
          <h1>Document Search</h1>
        </header>
        <main className="app-content">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/pdf/:documentId" element={<PDFReader />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      </div>
    </Router>
  );
}

export default App;