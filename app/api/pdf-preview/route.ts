import { NextRequest, NextResponse } from 'next/server';
import * as pdfjs from 'pdfjs-dist';
import { createCanvas } from 'canvas';
import fetch from 'node-fetch';

// Configuration constants
const CONFIG = {
  MAX_DURATION: 30, // seconds
  CACHE_DURATION: 86400, // 24 hours in seconds
  SCALE_FACTOR: 1.5,
  PDF_WORKER_URL: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`,
} as const;

// Type definitions
interface PdfPreviewParams {
  url: string;
  page: number;
}

interface PdfPreviewError {
  error: string;
  details?: string;
}

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = CONFIG.PDF_WORKER_URL;

/**
 * Validates the PDF preview request parameters
 * @param params The request parameters to validate
 * @returns Error message if validation fails, null otherwise
 */
function validateParams(params: PdfPreviewParams): string | null {
  if (!params.url) {
    return 'PDF URL is required';
  }
  if (!params.url.startsWith('http://') && !params.url.startsWith('https://')) {
    return 'Invalid URL format. Must start with http:// or https://';
  }
  if (params.page < 1) {
    return 'Page number must be greater than 0';
  }
  return null;
}

/**
 * Generates a preview image for a specific page of a PDF
 * @param request The incoming request containing PDF URL and page number
 * @returns NextResponse containing the preview image or error message
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: PdfPreviewParams = {
      url: searchParams.get('url') || '',
      page: parseInt(searchParams.get('page') || '1'),
    };

    // Validate parameters
    const validationError = validateParams(params);
    if (validationError) {
      return NextResponse.json(
        { error: validationError } as PdfPreviewError,
        { status: 400 }
      );
    }

    // Fetch the PDF
    const response = await fetch(params.url);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch PDF', details: response.statusText } as PdfPreviewError,
        { status: response.status }
      );
    }

    const pdfArrayBuffer = await response.arrayBuffer();
    
    // Load PDF using pdf.js
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfArrayBuffer) });
    const pdf = await loadingTask.promise;
    
    // Check if requested page exists
    if (params.page > pdf.numPages) {
      return NextResponse.json(
        { error: 'Page number out of range', details: `PDF has only ${pdf.numPages} pages` } as PdfPreviewError,
        { status: 400 }
      );
    }
    
    // Get the page
    const page = await pdf.getPage(params.page);
    
    // Set scale for rendering
    const viewport = page.getViewport({ scale: CONFIG.SCALE_FACTOR });
    
    // Create canvas for rendering
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    // Configure canvas context
    context.fillStyle = 'white';
    context.fillRect(0, 0, viewport.width, viewport.height);
    
    // Render page to canvas
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      transform: [1, 0, 0, 1, 0, 0]
    }).promise;
    
    // Convert canvas to image
    const imageBuffer = canvas.toBuffer('image/png');
    
    // Return image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${CONFIG.CACHE_DURATION}`,
      }
    });
  } catch (error: any) {
    console.error('PDF preview error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message } as PdfPreviewError,
      { status: 500 }
    );
  }
}

// Set max duration for the API route
export const maxDuration = CONFIG.MAX_DURATION;