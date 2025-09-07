// app/api/process-document-safe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Safe text chunking function with strict byte size control
function chunkTextSafely(text: string, maxBytes: number = 8000): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  
  let currentChunk = '';
  
  for (const word of words) {
    const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
    const testBytes = new TextEncoder().encode(testChunk).length;
    
    if (testBytes > maxBytes) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        // Single word is too long, truncate it
        const truncatedWord = word.substring(0, Math.floor(maxBytes / 4));
        chunks.push(truncatedWord);
      }
    } else {
      currentChunk = testChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // Validate all chunks
  return chunks.filter(chunk => {
    const bytes = new TextEncoder().encode(chunk).length;
    return bytes <= maxBytes && chunk.length > 10;
  });
}

// Create embeddings with strict size validation
async function createEmbeddingsSafely(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // Strict size check
      const chunkBytes = new TextEncoder().encode(chunk).length;
      console.log(`Chunk ${i + 1}/${chunks.length}: ${chunkBytes} bytes, ${chunk.length} chars`);
      
      if (chunkBytes > 10000) { // 10KB limit to be very safe
        console.warn(`Chunk ${i + 1} too large (${chunkBytes} bytes), truncating...`);
        const truncatedChunk = chunk.substring(0, 1500); // Truncate to 1500 chars (~6KB)
        console.log(`Truncated to: ${new TextEncoder().encode(truncatedChunk).length} bytes`);
        
        const model = genAI.getGenerativeModel({ model: "embedding-001" });
        const result = await model.embedContent(truncatedChunk);
        const embedding = result.embedding;
        
        if (!embedding || !embedding.values) {
          throw new Error('No embedding data in Gemini response');
        }

        embeddings.push(embedding.values);
      } else {
        const model = genAI.getGenerativeModel({ model: "embedding-001" });
        const result = await model.embedContent(chunk);
        const embedding = result.embedding;
        
        if (!embedding || !embedding.values) {
          throw new Error('No embedding data in Gemini response');
        }

        embeddings.push(embedding.values);
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error creating embedding for chunk ${i + 1}:`, error);
      
      // Try with an even smaller version of the chunk
      try {
        const miniChunk = chunk.substring(0, 500);
        console.log(`Retrying with mini-chunk: ${new TextEncoder().encode(miniChunk).length} bytes`);
        
        const model = genAI.getGenerativeModel({ model: "embedding-001" });
        const result = await model.embedContent(miniChunk);
        const embedding = result.embedding;
        
        if (embedding && embedding.values) {
          embeddings.push(embedding.values);
          console.log(`Successfully processed mini-chunk ${i + 1}`);
        } else {
          throw new Error('Failed even with mini-chunk');
        }
      } catch (retryError) {
        console.error(`Failed to process chunk ${i + 1} even with retry:`, retryError);
        // Skip this chunk and continue
        console.log(`Skipping chunk ${i + 1}`);
      }
    }
  }
  
  return embeddings;
}

// Store in vector database
async function storeInVectorDB(chunks: string[], embeddings: number[][], fileName: string) {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'rag-gemini-768');
    
    // Only create vectors for successfully embedded chunks
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

    // Upsert vectors to Pinecone
    await index.upsert(vectors);
    
    console.log(`Stored ${vectors.length} vectors for file: ${fileName}`);
    return vectors.length;
  } catch (error) {
    console.error('Error storing in vector DB:', error);
    throw new Error('Failed to store in vector database');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fileName, content, fileType } = await request.json();

    // Validate input
    if (!fileName || !content) {
      return NextResponse.json(
        { error: 'fileName and content are required' },
        { status: 400 }
      );
    }

    // Clean and preprocess text
    const cleanedText = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim();

    console.log(`Processing document: ${fileName} (${cleanedText.length} characters)`);

    // Chunk the text safely with strict byte limit
    const chunks = chunkTextSafely(cleanedText, 8000); // 8KB max per chunk
    console.log(`Created ${chunks.length} safe chunks for ${fileName}`);

    // Log chunk sizes for debugging
    chunks.forEach((chunk, i) => {
      const bytes = new TextEncoder().encode(chunk).length;
      console.log(`Chunk ${i + 1}: ${bytes} bytes, ${chunk.length} chars`);
    });

    // Create embeddings safely
    console.log('Creating embeddings safely...');
    const embeddings = await createEmbeddingsSafely(chunks);
    console.log(`Successfully created ${embeddings.length} embeddings`);

    // Store in vector database
    console.log('Storing in vector database...');
    const storedCount = await storeInVectorDB(chunks, embeddings, fileName);

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully with safe chunking',
      chunkCount: chunks.length,
      embeddingCount: embeddings.length,
      fileName: fileName,
      storedCount: storedCount,
    });

  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
