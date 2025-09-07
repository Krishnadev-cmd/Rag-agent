// app/api/process-document-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Optimized chunking - fewer, larger chunks
function chunkTextOptimized(text: string, maxBytes: number = 12000): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const testChunk = currentChunk + (currentChunk ? '. ' : '') + sentence.trim();
    const testBytes = new TextEncoder().encode(testChunk).length;
    
    if (testBytes > maxBytes) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence.trim();
      } else {
        // Sentence too long, split by words
        const words = sentence.trim().split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          const testWordChunk = wordChunk + (wordChunk ? ' ' : '') + word;
          const wordBytes = new TextEncoder().encode(testWordChunk).length;
          
          if (wordBytes > maxBytes) {
            if (wordChunk) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            }
          } else {
            wordChunk = testWordChunk;
          }
        }
        
        if (wordChunk.trim()) {
          currentChunk = wordChunk.trim();
        }
      }
    } else {
      currentChunk = testChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 20);
}

// Batch processing with concurrent requests
async function createEmbeddingsBatch(chunks: string[], batchSize: number = 5): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  console.log(`Processing ${chunks.length} chunks in batches of ${batchSize}`);
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}...`);
    
    // Process batch concurrently
    const batchPromises = batch.map(async (chunk, batchIndex) => {
      try {
        const chunkBytes = new TextEncoder().encode(chunk).length;
        
        if (chunkBytes > 15000) {
          const truncatedChunk = chunk.substring(0, 2000);
          console.log(`Truncating chunk ${i + batchIndex + 1}: ${chunkBytes} -> ${new TextEncoder().encode(truncatedChunk).length} bytes`);
          
          const model = genAI.getGenerativeModel({ model: "embedding-001" });
          const result = await model.embedContent(truncatedChunk);
          return result.embedding.values;
        } else {
          const model = genAI.getGenerativeModel({ model: "embedding-001" });
          const result = await model.embedContent(chunk);
          return result.embedding.values;
        }
      } catch (error) {
        console.error(`Error processing chunk ${i + batchIndex + 1}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Add successful embeddings
    batchResults.forEach((embedding, batchIndex) => {
      if (embedding) {
        embeddings.push(embedding);
        console.log(`✓ Chunk ${i + batchIndex + 1} processed`);
      } else {
        console.log(`✗ Chunk ${i + batchIndex + 1} failed`);
      }
    });
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return embeddings;
}

// Batch upsert to Pinecone
async function storeInVectorDBBatch(chunks: string[], embeddings: number[][], fileName: string) {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'rag-gemini-768');
    
    const vectors = [];
    for (let i = 0; i < Math.min(chunks.length, embeddings.length); i++) {
      vectors.push({
        id: `${fileName}-chunk-${i}-${Date.now()}`,
        values: embeddings[i],
        metadata: {
          text: chunks[i],
          fileName: fileName,
          chunkIndex: i,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Upsert in batches of 100 (Pinecone limit)
    const batchSize = 100;
    let storedCount = 0;
    
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
      storedCount += batch.length;
      console.log(`Stored batch: ${storedCount}/${vectors.length} vectors`);
    }
    
    console.log(`Successfully stored ${storedCount} vectors for file: ${fileName}`);
    return storedCount;
  } catch (error) {
    console.error('Error storing in vector DB:', error);
    throw new Error('Failed to store in vector database');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, content, fileType } = await request.json();

    if (!fileName || !content) {
      return NextResponse.json(
        { error: 'fileName and content are required' },
        { status: 400 }
      );
    }

    const cleanedText = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    console.log(`Processing document: ${fileName} (${cleanedText.length} characters)`);

    // Create larger, fewer chunks
    const chunks = chunkTextOptimized(cleanedText, 12000);
    console.log(`Created ${chunks.length} optimized chunks for ${fileName}`);

    // Process embeddings in batches
    const startTime = Date.now();
    console.log('Creating embeddings in batches...');
    const embeddings = await createEmbeddingsBatch(chunks, 5);
    const embeddingTime = (Date.now() - startTime) / 1000;
    console.log(`Created ${embeddings.length} embeddings in ${embeddingTime}s`);

    // Store in batches
    console.log('Storing in vector database...');
    const storedCount = await storeInVectorDBBatch(chunks, embeddings, fileName);
    const totalTime = (Date.now() - startTime) / 1000;

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully with batch optimization',
      chunkCount: chunks.length,
      embeddingCount: embeddings.length,
      fileName: fileName,
      storedCount: storedCount,
      processingTimeSeconds: totalTime,
    });

  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
