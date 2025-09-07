// app/api/cleanup-corrupted/route.ts
import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

export async function POST() {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'rag-gemini-768');
    
    console.log('Starting cleanup of corrupted vectors...');
    
    // Query to get all vectors with metadata
    const queryResponse = await index.query({
      vector: new Array(768).fill(0.001),
      topK: 10000,
      includeMetadata: true,
      includeValues: false,
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No vectors found in the database',
        deletedCount: 0,
      });
    }

    // Find corrupted vectors (those with binary/corrupted text)
    const corruptedVectorIds: string[] = [];
    
    queryResponse.matches.forEach(match => {
      const text = match.metadata?.text as string;
      
      if (text) {
        // Check for signs of binary corruption
        const hasControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/.test(text);
        const hasBinaryMarkers = text.includes('PK') && text.includes('word/_rels');
        const isVeryShort = text.trim().length < 10;
        const hasHighNonPrintable = (text.match(/[^\x20-\x7E\n\r\t]/g) || []).length > text.length * 0.3;
        
        if (hasControlChars || hasBinaryMarkers || isVeryShort || hasHighNonPrintable) {
          corruptedVectorIds.push(match.id);
          console.log(`Found corrupted vector: ${match.id} (${match.metadata?.fileName})`);
        }
      }
    });

    console.log(`Found ${corruptedVectorIds.length} corrupted vectors to delete`);

    if (corruptedVectorIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No corrupted vectors found',
        deletedCount: 0,
      });
    }

    // Delete corrupted vectors in batches
    const batchSize = 100;
    let deletedCount = 0;
    
    for (let i = 0; i < corruptedVectorIds.length; i += batchSize) {
      const batch = corruptedVectorIds.slice(i, i + batchSize);
      await index.deleteMany(batch);
      deletedCount += batch.length;
      console.log(`Deleted batch: ${deletedCount}/${corruptedVectorIds.length} vectors`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} corrupted vectors`,
      deletedCount: deletedCount,
    });

  } catch (error) {
    console.error('Error cleaning up corrupted vectors:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup corrupted vectors',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
