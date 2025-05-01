import { NextRequest, NextResponse } from 'next/server';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import fetch from 'node-fetch';

export const maxDuration = 60; // Set max duration to 60 seconds

export async function POST(request: NextRequest) {
  try {
    const { pdfUrl, pages } = await request.json();
    
    if (!pdfUrl || !pages || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json({ 
        error: 'PDF URL and page ranges are required' 
      }, { status: 400 });
    }
    
    // Fetch the original PDF
    const response = await fetch(pdfUrl);
    const originalPdfBytes = await response.arrayBuffer();
    
    // Create a new PDF document with only the specified pages
    const pdfDoc = await PDFDocument.create();
    const sourcePdfDoc = await PDFDocument.load(originalPdfBytes);
    
    // Process each page range
    for (const range of pages) {
      const { start, end } = range;
      
      // Validate range
      if (start < 1 || end < start || end > sourcePdfDoc.getPageCount()) {
        continue; // Skip invalid ranges
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
    const newPdfBytes = await pdfDoc.save();
    
    // Return the new PDF for printing
    return new NextResponse(newPdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="print.pdf"'
      }
    });
  } catch (error: any) {
    console.error('PDF print error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}