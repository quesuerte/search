import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { EpubReader } from 'foliate-js';
import 'foliate-js/dist/foliate.css';
import { fetchEPUB } from '../api/api';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useSpring, animated } from '@react-spring/web';
import { createUseGesture, dragAction, pinchAction } from '@use-gesture/react';

import '../App.css';

const useGesture = createUseGesture([dragAction, pinchAction]);

function EPUBReader() {
  const location = useLocation();
  const title = location.state?.title || 'EPUB Document';
  const { documentId } = useParams();
  const [epubUrl, setEpubUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  
  // References for EPUB reader and container
  const readerRef = useRef(null);
  const epubContainerRef = useRef(null);
  
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.5;
  
  // Spring animation for gestures
  const [style, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    config: { tension: 250, friction: 30 },
  }));
  
  const ref = useRef(null);
  const flipped = useRef(false);
  const VELOCITY_TRIGGER = 0.5;

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the EPUB
        const epubData = await fetchEPUB(documentId);
        const url = URL.createObjectURL(epubData);
        setEpubUrl(url);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading EPUB:', err);
        setError('Failed to load the document. Please try again later.');
        setIsLoading(false);
      }
    };

    const handler = (e) => e.preventDefault();
    
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 768;
      setIsMobile(!isDesktop);
    };
    
    const handleKeyDown = (e) => {
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
    document.addEventListener('gesturestart', handler);
    document.addEventListener('gesturechange', handler);
    document.addEventListener('gestureend', handler);

    handleResize(); // Call once on mount
    window.addEventListener('resize', handleResize);

    loadDocument();

    // Clean up URL object when component unmounts
    return () => {
      if (epubUrl) {
        URL.revokeObjectURL(epubUrl);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('gesturestart', handler);
      document.removeEventListener('gesturechange', handler);
      document.removeEventListener('gestureend', handler);
    };
  }, [documentId]);

  useEffect(() => {
    // Initialize EPUB reader when URL is available
    if (epubUrl && !isLoading && !error) {
      initializeEpubReader();
    }
  }, [epubUrl, isLoading, error]);

  const initializeEpubReader = async () => {
    try {
      if (!epubContainerRef.current) return;
      
      // Clear any existing content
      epubContainerRef.current.innerHTML = '';
      
      const reader = new EpubReader(epubUrl, {
        flow: 'paginated',
        renderTo: epubContainerRef.current,
        width: epubContainerRef.current.clientWidth,
        height: epubContainerRef.current.clientHeight,
      });
      
      await reader.open();
      
      // Set total pages based on spine items
      setTotalPages(reader.book.spine.length);
      
      // Store reader instance
      readerRef.current = reader;
      
      // Add event listeners to track page changes
      reader.on('relocated', (location) => {
        setCurrentPage(location.start.cfi ? location.start.cfi : 1);
      });
      
      // Apply initial scaling
      applyScale(scale);
      
    } catch (err) {
      console.error('Error initializing EPUB reader:', err);
      setError('Failed to initialize the EPUB reader. Please try again later.');
    }
  };

  const goToPrevPage = () => {
    if (readerRef.current) {
      readerRef.current.prev();
    }
  };

  const goToNextPage = () => {
    if (readerRef.current) {
      readerRef.current.next();
    }
  };

  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, MAX_SCALE);
    setScale(newScale);
    applyScale(newScale);
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, MIN_SCALE);
    setScale(newScale);
    applyScale(newScale);
  };

  const applyScale = (newScale) => {
    if (readerRef.current && epubContainerRef.current) {
      epubContainerRef.current.style.transform = `scale(${newScale})`;
      epubContainerRef.current.style.transformOrigin = 'center center';
    }
  };

  useGesture(
    {
      onDrag: ({ active, pinching, cancel, last, direction: [xDir], offset: [x, y], velocity: [vx] }) => {
        if (pinching) return cancel();
        
        const trigger = vx > VELOCITY_TRIGGER;
        
        if (!active && trigger && !flipped.current) {
          if (xDir > 0) {
            goToPrevPage();
          } else {
            goToNextPage();
          }
          flipped.current = true;
          return cancel();
        }
        
        // Only apply visual drag if NOT a fling
        if (vx < VELOCITY_TRIGGER) {
          api.start({ x, y });
        }

        // Reset on gesture end
        if (!active && last) {
          flipped.current = false;
        }
      },
      onPinch: ({ origin: [ox, oy], first, last, movement: [ms], offset: [s, _], memo }) => {
        if (!ref.current) {
          return;
        }
        
        if (first) {
          const { width, height, x, y } = ref.current.getBoundingClientRect();
          const tx = ox - (x + width / 2);
          const ty = oy - (y + height / 2);
          memo = [style.x.get(), style.y.get(), tx, ty];
        }

        const x = memo[0] - (ms - 1) * memo[2];
        const y = memo[1] - (ms - 1) * memo[3];
        
        if (last) {
          if (s < MIN_SCALE) {
            setScale(MIN_SCALE);
            applyScale(MIN_SCALE);
          } else if (s > MAX_SCALE) {
            setScale(MAX_SCALE);
            applyScale(MAX_SCALE);
          } else {
            setScale(s);
            applyScale(s);
          }
        } else {
          api.start({ scale: s, x, y });
        }
        
        return memo;
      },
    },
    {
      target: ref,
      drag: { from: () => [style.x.get(), style.y.get()] },
      pinch: { scaleBounds: { min: MIN_SCALE, max: MAX_SCALE }, rubberband: true },
    }
  );

  return (
    <div className="epub-reader" style={{ touchAction: isMobile ? 'none' : 'auto' }}>
      <div className="epub-header">
        <Link to="/" className="back-button">
          {isMobile ? '←' : '← Back to Search'}
        </Link>
        <div className="document-info" style={
          isMobile 
          ? { fontSize: '8px' } 
          : undefined
        }>
          <h2>{title}</h2>
        </div>
      </div>

      {isLoading && <div className="loading">Loading document...</div>}
      
      {error && <div className="error-message">{error}</div>}

      {!isLoading && !error && epubUrl && (
        <div className="epub-container">
          {isMobile ? (
            <div className="epub-controls">
              <div className="page-navigation">
                <span>
                  {currentPage} / {totalPages}
                </span>
              </div>
            </div>
          ) : (
            <div className="epub-controls">
              <div className="page-navigation">
                <button onClick={goToPrevPage}>
                  Previous
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button onClick={goToNextPage}>
                  Next
                </button>
              </div>
              
              <div className="zoom-controls">
                <MinusIcon onClick={zoomOut}/>
                <PlusIcon onClick={zoomIn}/>
              </div>
            </div>
          )}

          <div className="epub-document">
            {isMobile ? (
              <animated.div ref={ref} style={{...style, touchAction: 'none'}}>
                <div ref={epubContainerRef} className="epub-content"></div>
              </animated.div>
            ) : (
              <div ref={epubContainerRef} className="epub-content"></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EPUBReader;