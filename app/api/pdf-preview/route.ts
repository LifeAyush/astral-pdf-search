import { NextRequest, NextResponse } from 'next/server';
import * as pdfjs from 'pdfjs-dist';
import { createCanvas } from 'canvas';
import fetch from 'node-fetch';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export const maxDuration = 30; // Set max duration to 30 seconds

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pdfUrl = searchParams.get('url');
    const pageNum = parseInt(searchParams.get('page') || '1');
    
    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF URL is required' }, { status: 400 });
    }
    
    // Fetch the PDF
    const response = await fetch(pdfUrl);
    const pdfArrayBuffer = await response.arrayBuffer();
    
    // Load PDF using pdf.js
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfArrayBuffer) });
    const pdf = await loadingTask.promise;
    
    // Check if requested page exists
    if (pageNum < 1 || pageNum > pdf.numPages) {
      return NextResponse.json({ error: 'Page number out of range' }, { status: 400 });
    }
    
    // Get the page
    const page = await pdf.getPage(pageNum);
    
    // Set scale for rendering
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
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
    
    // Return image
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    });
  } catch (error: any) {
    console.error('PDF preview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}