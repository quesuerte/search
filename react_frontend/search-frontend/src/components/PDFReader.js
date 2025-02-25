import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { fetchPDF, fetchDocumentMetadata } from '../api/api';

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

function PDFReader() {
  const { documentId } = useParams();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        
        // Fetch document metadata
        const docMetadata = await fetchDocumentMetadata(documentId);
        setMetadata(docMetadata);
        
        // Fetch the PDF
        const pdfData = await fetchPDF(documentId);
        const url = URL.createObjectURL(pdfData);
        setPdfUrl(url);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load the document. Please try again later.');
        setIsLoading(false);
      }
    };

    loadDocument();

    // Clean up URL object when component unmounts
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [documentId]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.2, 2.5));
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.2, 0.5));
  };

  return (
    <div className="pdf-reader">
      <div className="pdf-header">
        <Link to="/" className="back-button">
          ← Back to Search
        </Link>
        
        {metadata && (
          <div className="document-info">
            <h2>{metadata.title}</h2>
            {metadata.author && <p>Author: {metadata.author}</p>}
            {metadata.datePublished && <p>Published: {metadata.datePublished}</p>}
          </div>
        )}
      </div>

      {isLoading && <div className="loading">Loading document...</div>}
      
      {error && <div className="error-message">{error}</div>}

      {!isLoading && !error && pdfUrl && (
        <div className="pdf-container">
          <div className="pdf-controls">
            <div className="page-navigation">
              <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
                Previous
              </button>
              <span>
                Page {pageNumber} of {numPages}
              </span>
              <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
                Next
              </button>
            </div>
            
            <div className="zoom-controls">
              <button onClick={zoomOut}>Zoom Out</button>
              <button onClick={zoomIn}>Zoom In</button>
            </div>
          </div>

          <div className="pdf-document">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              error={<div>Failed to load PDF</div>}
              loading={<div>Loading PDF...</div>}
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFReader;