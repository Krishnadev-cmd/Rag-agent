// app/api/parse-docx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  try {
    console.log('DOCX parsing request received');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`Processing DOCX file: ${file.name}, size: ${file.size} bytes`);

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('File converted to ArrayBuffer');

    // Extract text using mammoth
    const result = await mammoth.extractRawText({ arrayBuffer });
    const extractedText = result.value;

    console.log(`Extracted ${extractedText.length} characters from DOCX`);

    if (!extractedText || extractedText.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: 'DOCX appears to be empty or text could not be extracted. The document might contain only images or be corrupted.',
      });
    }

    // Clean up the text
    const cleanText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    console.log(`Cleaned text: ${cleanText.length} characters`);

    return NextResponse.json({
      success: true,
      text: cleanText,
      originalLength: extractedText.length,
      cleanedLength: cleanText.length,
      fileName: file.name,
    });

  } catch (error) {
    console.error('Error parsing DOCX:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to parse DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
