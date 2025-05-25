import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Lazy load components
const SearchPage = lazy(() => import('./components/SearchPage'));
const PDFReader = lazy(() => import('./components/PDFReader'));
const EPUBReader = lazy(() => import('./components/EPUBReader'));

// Loading component
const LoadingFallback = () => <div className="loading">Loading...</div>;

function App() {
  return (
    <Router>
      <div className="background-image">
        <div className="glass-panel">
          <div className="app-container">
            <main className="app-content">
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<SearchPage />} />
                  <Route path="/pdf/:documentId" element={<PDFReader />} />
                  <Route path="/epub/:documentId" element={<EPUBReader />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;