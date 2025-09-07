// app/api/latest-file/route.ts
import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

export async function GET() {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'rag-gemini-768');
    
    // Query to get all vectors with metadata
    const queryResponse = await index.query({
      vector: new Array(768).fill(0.001), // Small non-zero values to get matches
      topK: 10000, // Large number to get all vectors
      includeMetadata: true,
      includeValues: false,
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files found in the database',
      });
    }

    // Extract unique files with their upload timestamps
    const fileMap = new Map<string, { fileName: string; uploadedAt: Date }>();
    
    queryResponse.matches.forEach(match => {
      const fileName = match.metadata?.fileName as string;
      const timestamp = match.metadata?.timestamp as string;
      
      console.log('Vector metadata:', {
        fileName,
        timestamp,
        allMetadata: match.metadata
      });
      
      if (fileName) {
        // Use timestamp if available, otherwise current timestamp
        const uploadDate = timestamp ? new Date(timestamp) : new Date();
        
        // Keep track of the latest upload time for each file
        if (!fileMap.has(fileName) || uploadDate > fileMap.get(fileName)!.uploadedAt) {
          fileMap.set(fileName, { fileName, uploadedAt: uploadDate });
        }
      }
    });

    if (fileMap.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid files found',
      });
    }

    // Find the latest file
    let latestFile: { fileName: string; uploadedAt: Date } | null = null;
    
    for (const fileInfo of fileMap.values()) {
      if (!latestFile || fileInfo.uploadedAt > latestFile.uploadedAt) {
        latestFile = fileInfo;
      }
    }

    return NextResponse.json({
      success: true,
      latestFile: latestFile?.fileName,
      uploadedAt: latestFile?.uploadedAt.toISOString(),
      totalFiles: fileMap.size,
    });

  } catch (error) {
    console.error('Error getting latest file:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get latest file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
