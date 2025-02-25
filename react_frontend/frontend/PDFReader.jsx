import { useState, useEffect } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";

export default function PdfViewerWithNotepad() {
  const [pdfFile, setPdfFile] = useState("/sample.pdf"); // Change this to your PDF file path
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight" && pageNumber < numPages) {
        setPageNumber((prev) => prev + 1);
      } else if (event.key === "ArrowLeft" && pageNumber > 1) {
        setPageNumber((prev) => prev - 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pageNumber, numPages]);

  return (
    <div className="flex p-4 gap-4">
      {/* PDF Viewer */}
      <div className="w-2/3 border p-2 rounded shadow-lg">
        <Document file={pdfFile} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
          <Page pageNumber={pageNumber} />
        </Document>
        <p className="text-center mt-2">Page {pageNumber} of {numPages}</p>
      </div>
      
      {/* Notepad */}
      <div className="w-1/3 border p-2 rounded shadow-lg flex flex-col">
        <h2 className="text-lg font-bold mb-2">Notepad</h2>
        <textarea 
          className="w-full h-64 border p-2 rounded"
          placeholder="Write your notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  );
}