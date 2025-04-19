import React, { /*useCallback,*/ useEffect, useState } from 'react';
import { useLocation, useParams, /*useSearchParams,*/ Link } from 'react-router-dom';
import { Document, Page } from 'react-pdf';
import { fetchPDF } from '../api/api';
import * as pdfjs from 'pdfjs-dist'
import "pdfjs-dist/build/pdf.worker.mjs";
//import pdfjsWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.entry";
//import 'pdfjs-dist/webpack';

import '../App.css'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { MinusIcon, PlusIcon } from 'lucide-react';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


function PDFReader() {
  /*const [searchText, setSearchText] = useState('');*/
  /*const queryParam = 'query';*/
  const getPageFromHash = () => {
    const match = location.hash.match(/#page=(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  };
  /*const textRenderer = useCallback(
    (textItem) => highlightPattern(textItem.str, searchText),
    [searchText]
  );
  const highlightPattern = (text, pattern) => {
    return text.replace(pattern, (value) => `<mark>${value}</mark>`);
  }*/
  
  const location = useLocation();
  const title = location.state.title;
  const { documentId } = useParams();
  /*const [searchParams] = useSearchParams();*/
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(100);
  const [pageNumber, setPageNumber] = useState(getPageFromHash);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);
  
  const [isMobile, setIsMobile] = useState(false);
  // Set isOpen based on screen width
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      setIsMobile(!isDesktop)
    };

    handleResize(); // Call once on mount
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        
        
        // Fetch the PDF
        const pdfData = await fetchPDF(documentId);
        const url = URL.createObjectURL(pdfData);
        setPdfUrl(url);
        
        setIsLoading(false);
        /*setSearchText(searchParams.get(queryParam).toLowerCase());*/
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
    /*setSearchText('');*/
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  };

  const goToNextPage = () => {
    /*setSearchText('');*/
    setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.2, 2.5));
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.2, 0.5));
  };
  /* text-overflow: ellipsis; */
  return (
    <div className="pdf-reader">
      <div className="pdf-header">
        <Link to="/" className="back-button">
          {isMobile ? '←' : '← Back to Search'}
        </Link>
        <div className="document-info" style={
          isMobile 
          ? { 
              fontSize: '8px', 
              /*whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%' */
            } 
          : undefined}
        >
          <h2>{title}</h2>
        </div>
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
                {pageNumber} / {numPages}
              </span>
              <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
                Next
              </button>
            </div>
            
            <div className="zoom-controls" style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
              <MinusIcon onClick={zoomOut}/>
              <PlusIcon onClick={zoomIn}/>
            </div>
          </div>

          <div className="pdf-document">
            <Document
              file={pdfUrl}
              onItemClick={({ pageNumber }) => setPageNumber(pageNumber)}
              onLoadSuccess={onDocumentLoadSuccess}
              error={<div>Failed to load PDF</div>}
              loading={<div>Loading PDF...</div>}
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                /*customTextRenderer={textRenderer}*/
              />
            </Document>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFReader;