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
  //const [dragBounds, setDragBounds] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const pdfcontainer = React.useRef(null);

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
      //updateBounds()
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

    // const updateBounds = () => {
    //   if (!ref.current) return;
  
    //   const container = pdfcontainer.current
    //   if (!container) return;
  
    //   const containerRect = container.getBoundingClientRect();
    //   const contentRect = ref.current.getBoundingClientRect();
  
    //   const maxX = Math.max(0, (contentRect.width - containerRect.width) / 2);
    //   const maxY = Math.max(0, (contentRect.height - containerRect.height) / 2);
    //   setDragBounds({
    //     left: -maxX,
    //     right: maxX,
    //     top: -maxY,
    //     bottom: maxY,
    //   });
    // };
  
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
    config: { tension: 250, friction: 30 },
  }))
  const ref = React.useRef(null)

  // Variables involved with swiping
  const VELOCITY_TRIGGER = 0.5;
  const flipped = React.useRef(false)

  useGesture(
    {
      // onHover: ({ active, event }) => console.log('hover', event, active),
      // onMove: ({ event }) => console.log('move', event),
      onDrag: ({ active, pinching, cancel, last, direction: [xDir], offset: [x, y], velocity: [vx] }) => {
        if (pinching) return cancel()
        const trigger = vx > VELOCITY_TRIGGER
        // This is not working correctly
        if (!active && trigger && !flipped.current) {
          if (xDir > 0) {
            goToPrevPage()
          } else {
            goToNextPage()
          }
          flipped.current = true
          return cancel()
        }
        // Only apply visual drag if NOT a fling
        if (vx < VELOCITY_TRIGGER) {
          api.start({ x, y})
        }

        // Reset on gesture end
        if (!active && last) {
          flipped.current = false
        }
      },
      onPinch: ({ origin: [ox, oy], first, last, movement: [ms], offset: [s, _], memo }) => {
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
        // if (last) {
        //   if (s < MIN_SCALE) {
        //     setScale(MIN_SCALE)
        //   } else if (s > MAX_SCALE) {
        //     setScale(MAX_SCALE)
        //   } else {
        //     setScale(s)
        //   }
        // }
        api.start({ scale: s, x, y })
        return memo
      },
    },
    {
      target: ref,
      drag: { from: () => [style.x.get(), style.y.get()], /* bounds: () => dragBounds */ },
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
          {isMobile ? (<div className="pdf-controls">
            <div className="page-navigation">
              <span>
                {pageNumber} / {numPages}
              </span>
            </div>
          </div>) : (<div className="pdf-controls">
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
          </div>) }

          <div className="pdf-document" ref={pdfcontainer}>
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