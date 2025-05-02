declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFInfo {
    Pages?: string;
    [key: string]: any;
  }

  interface PDFData {
    numpages?: number;
    numrender?: number;
    info?: PDFInfo;
    metadata?: any;
    text?: string;
    version?: string;
  }

  interface PDFOptions {
    max?: number;
    pagerender?: (pageData: any) => Promise<string>;
    [key: string]: any;
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  
  export default pdfParse;
} 