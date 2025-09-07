// app/api/parse-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to avoid module loading issues
async function parsePdfContent(buffer: Buffer) {
  try {
    const pdf = await import('pdf-parse');
    return await pdf.default(buffer);
  } catch (error) {
    console.error('Error with pdf-parse:', error);
    throw new Error('Failed to parse PDF content');
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`Parsing PDF: ${file.name} (${file.size} bytes)`);

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('Buffer created, parsing PDF...');

    // Parse PDF with error handling
    const data = await parsePdfContent(buffer);
    
    console.log(`PDF parsed successfully: ${data.numpages} pages, ${data.text.length} characters`);
    
    // Basic text validation
    if (!data.text || data.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'PDF appears to be empty or text could not be extracted' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      text: data.text,
      pages: data.numpages,
      fileName: file.name,
      characterCount: data.text.length,
    });

  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { 
        error: 'Failed to parse PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
