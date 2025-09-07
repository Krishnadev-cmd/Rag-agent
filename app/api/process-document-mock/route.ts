// app/api/process-document-mock/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Mock embedding function for testing without OpenAI credits
function createMockEmbedding(text: string): number[] {
  // Create a deterministic mock embedding based on text content
  const embedding = new Array(1536).fill(0);
  let hash = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Fill embedding with pseudo-random values based on text hash
  for (let i = 0; i < 1536; i++) {
    embedding[i] = Math.sin(hash + i) * 0.1; // Small values between -0.1 and 0.1
  }
  
  return embedding;
}

// Text chunking function
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }
  
  return chunks;
}

// Create mock embeddings
async function createMockEmbeddings(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const chunk of chunks) {
    const embedding = createMockEmbedding(chunk);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

// Mock storage function
async function storeMockVectors(chunks: string[], embeddings: number[][], fileName: string) {
  // For now, just log the data - you can implement local storage or use a different vector DB
  console.log(`Mock storage: ${chunks.length} chunks from ${fileName}`);
  
  const vectors = chunks.map((chunk, index) => ({
    id: `${fileName}-chunk-${index}-${Date.now()}`,
    values: embeddings[index],
    metadata: {
      text: chunk,
      fileName: fileName,
      chunkIndex: index,
      timestamp: new Date().toISOString(),
    },
  }));

  // You could store these in a local JSON file or in-memory storage
  console.log('Vectors created:', vectors.length);
  return vectors.length;
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

    // Chunk the text
    const chunks = chunkText(cleanedText, 1000, 200);
    console.log(`Created ${chunks.length} chunks for ${fileName}`);

    // Create mock embeddings
    console.log('Creating mock embeddings...');
    const embeddings = await createMockEmbeddings(chunks);

    // Store mock vectors
    console.log('Storing mock vectors...');
    const storedCount = await storeMockVectors(chunks, embeddings, fileName);

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully (using mock embeddings)',
      chunkCount: chunks.length,
      fileName: fileName,
      storedCount: storedCount,
      note: 'Using mock embeddings - add OpenAI credits for real embeddings',
    });

  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
