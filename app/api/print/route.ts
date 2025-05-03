import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import fetch from 'node-fetch';

// Type definitions
type PageRange = {
  start: number;
  end: number;
};

type PrintRequest = {
  pdfUrl: string;
  pages: PageRange[];
};

type ApiResponse = {
  error?: string;
};

/**
 * Validates the print request input
 * @param request The print request to validate
 * @returns A validation error message or null if valid
 */
const validatePrintRequest = (request: PrintRequest): string | null => {
  if (!request.pdfUrl) {
    return 'PDF URL is required';
  }
  
  if (!request.pages || !Array.isArray(request.pages) || request.pages.length === 0) {
    return 'At least one page range is required';
  }
  
  for (const range of request.pages) {
    if (!range.start || !range.end || typeof range.start !== 'number' || typeof range.end !== 'number') {
      return 'Each page range must have valid start and end values';
    }
  }
  
  return null;
};

/**
 * Fetches a PDF from a URL
 * @param url The URL of the PDF to fetch
 * @returns The PDF as an ArrayBuffer
 */
const fetchPdf = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }
  
  return response.arrayBuffer();
};

/**
 * Creates a new PDF with only the specified pages
 * @param originalPdfBytes The original PDF as an ArrayBuffer
 * @param pageRanges The page ranges to include in the new PDF
 * @returns The new PDF as a Uint8Array
 */
const createPrintablePdf = async (
  originalPdfBytes: ArrayBuffer, 
  pageRanges: PageRange[]
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const sourcePdfDoc = await PDFDocument.load(originalPdfBytes);
  const pageCount = sourcePdfDoc.getPageCount();
  
  // Process each page range
  for (const range of pageRanges) {
    const { start, end } = range;
    
    // Validate range
    if (start < 1 || end < start || end > pageCount) {
      console.warn(`Skipping invalid page range: ${start}-${end} (document has ${pageCount} pages)`);
      continue;
    }
    
    // Copy pages from source to new document (0-indexed in pdf-lib)
    const pagesToCopy = [];
    for (let i = start - 1; i < end; i++) {
      pagesToCopy.push(i);
    }
    
    const copiedPages = await pdfDoc.copyPages(sourcePdfDoc, pagesToCopy);
    copiedPages.forEach(page => pdfDoc.addPage(page));
  }
  
  // Save the new PDF
  return pdfDoc.save();
};

/**
 * POST handler for creating a printable PDF from page ranges
 * @param request The incoming request with PDF URL and page ranges
 * @returns A NextResponse with either the PDF or an error message
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const data = await request.json() as PrintRequest;
    
    // Validate request
    const validationError = validatePrintRequest(data);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    
    // Fetch the original PDF
    const originalPdfBytes = await fetchPdf(data.pdfUrl);
    
    // Create a new PDF with only the specified pages
    const newPdfBytes = await createPrintablePdf(originalPdfBytes, data.pages);
    
    // Return the new PDF for printing
    return new NextResponse(newPdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="print.pdf"'
      }
    });
  } catch (error: any) {
    console.error('PDF print error:', error);
    return NextResponse.json({ 
      error: `Failed to process PDF: ${error.message}` 
    }, { status: 500 });
  }
}