// app/api/process-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

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

// Create embeddings using OpenAI API (you'll need to install openai package)
async function createEmbeddings(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const chunk of chunks) {
    try {
      // Using OpenAI embeddings API
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small', // or text-embedding-3-large
          input: chunk,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Error:', response.status, errorText);
        
        if (response.status === 429) {
          throw new Error('OpenAI API quota exceeded. Please add credits to your OpenAI account or use the mock endpoint at /api/process-document-mock for testing.');
        }
        
        throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('OpenAI Response:', JSON.stringify(data, null, 2));
      
      // Check if the response has the expected structure
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error('Unexpected OpenAI response structure:', data);
        throw new Error('Invalid response structure from OpenAI API');
      }

      if (!data.data[0].embedding) {
        console.error('No embedding found in response:', data.data[0]);
        throw new Error('No embedding data in OpenAI response');
      }

      embeddings.push(data.data[0].embedding);
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw new Error('Failed to create embeddings');
    }
  }
  
  return embeddings;
}

// Store in vector database (Pinecone implementation)
async function storeInVectorDB(chunks: string[], embeddings: number[][], fileName: string) {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'ai-agent');
    
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

    // Chunk the text
    const chunks = chunkText(cleanedText, 1000, 200);
    console.log(`Created ${chunks.length} chunks for ${fileName}`);

    // Create embeddings
    console.log('Creating embeddings...');
    const embeddings = await createEmbeddings(chunks);

    // Store in vector database
    console.log('Storing in vector database...');
    const storedCount = await storeInVectorDB(chunks, embeddings, fileName);

    return NextResponse.json({
      success: true,
      message: 'Document processed successfully',
      chunkCount: chunks.length,
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