import React, { /*useCallback,*/ useEffect, useState} from 'react';
import { useLocation, useParams, /*useSearchParams,*/ Link } from 'react-router-dom';
import { Document, Page } from 'react-pdf';
import { fetchPDF } from '../api/api';
import * as pdfjs from 'pdfjs-dist'
import "pdfjs-dist/build/pdf.worker.mjs";

import '../App.css'
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { MinusIcon, PlusIcon } from 'lucide-react';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
import { useSpring, animated } from '@react-spring/web'
import { createUseGesture, dragAction, pinchAction } from '@use-gesture/react'

const useGesture = createUseGesture([dragAction, pinchAction])

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
    const handler = (e) => e.preventDefault()
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      setIsMobile(!isDesktop)
    };
    const handleKeyDown = (e) => {
      // Normalize zoom keys
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1.0);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPage();
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('gesturestart', handler)
    document.addEventListener('gesturechange', handler)
    document.addEventListener('gestureend', handler)

    handleResize(); // Call once on mount
    window.addEventListener('resize', handleResize);

    loadDocument();

    // Clean up URL object when component unmounts
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('gesturestart', handler)
      document.removeEventListener('gesturechange', handler)
      document.removeEventListener('gestureend', handler)
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

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.5;

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.2, MAX_SCALE));
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.2, MIN_SCALE));
  };

  const [style, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
  }))
  const ref = React.useRef(null)

  useGesture(
    {
      // onHover: ({ active, event }) => console.log('hover', event, active),
      // onMove: ({ event }) => console.log('move', event),
      onDrag: ({ active, pinching, cancel, movement: [mx], direction: [xDir], offset: [x, y], ...rest }) => {
        if (pinching) return cancel()
        // This is not working correctly
        // if (active && Math.abs(mx) > window.innerWidth / 2) {
        //   if (xDir > 0) {
        //     goToPrevPage()
        //   } else {
        //     goToNextPage()
        //   }
        //   api.start({ x: 0, y: 0, scale: 1 })
        //   return cancel()
        // }
        api.start({ x, y })
      },
      onPinch: ({ origin: [ox, oy], first, movement: [ms], offset: [s, _], memo }) => {
        if (!ref.current) {
          return
        }
        if (first) {
          const { width, height, x, y } = ref.current.getBoundingClientRect()
          const tx = ox - (x + width / 2)
          const ty = oy - (y + height / 2)
          memo = [style.x.get(), style.y.get(), tx, ty]
        }

        const x = memo[0] - (ms - 1) * memo[2]
        const y = memo[1] - (ms - 1) * memo[3]
        // This seems to break scaling
        // if (s < MIN_SCALE) {
        //   setScale(MIN_SCALE)
        // } else if (s > MAX_SCALE) {
        //   setScale(MAX_SCALE)
        // } else {
        //   setScale(s ?? 1)
        // }
        api.start({ scale: s, x, y })
        return memo
      },
    },
    {
      target: ref,
      drag: { from: () => [style.x.get(), style.y.get()] },
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, rubberband: true },
    }
  )

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
          <div className="pdf-controls" style={{display: isMobile ? 'none' : 'flex'}}>
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
            
            <div className="zoom-controls">
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
              { isMobile ? (<animated.div ref={ref} style={{...style, touchAction: 'none'}}>
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                /*customTextRenderer={textRenderer}*/
              />
              </animated.div>) : (<Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                /*customTextRenderer={textRenderer}*/
              />)}
            </Document>
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFReader;