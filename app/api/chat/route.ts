// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Function to create embedding for user query
async function createQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error creating query embedding:', error);
    throw new Error('Failed to create query embedding');
  }
}

// Function to retrieve relevant documents from vector database
async function retrieveRelevantDocs(queryEmbedding: number[], topK: number = 5) {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'ai-agent');
    
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
      includeValues: false,
    });

    return queryResponse.matches?.map(match => ({
      text: match.metadata?.text as string,
      score: match.score,
      fileName: match.metadata?.fileName as string,
    })) || [];
  } catch (error) {
    console.error('Error retrieving documents:', error);
    throw new Error('Failed to retrieve relevant documents');
  }
}

// Function to generate response using OpenAI Chat Completion
async function generateResponse(query: string, context: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // or gpt-3.5-turbo for cheaper option
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that answers questions based on the provided context. 
                     Use only the information from the context to answer questions. 
                     If the context doesn't contain enough information to answer the question, 
                     say so politely and ask for clarification.
                     
                     Context:
                     ${context}`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Validate input
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Step 1: Create embedding for user query
    console.log('Creating query embedding...');
    const queryEmbedding = await createQueryEmbedding(message);

    // Step 2: Retrieve relevant documents
    console.log('Retrieving relevant documents...');
    const relevantDocs = await retrieveRelevantDocs(queryEmbedding, 5);

    if (relevantDocs.length === 0) {
      return NextResponse.json({
        success: true,
        response: "I don't have any relevant information in my knowledge base to answer your question. Please make sure you've uploaded some documents first.",
      });
    }

    // Step 3: Prepare context from retrieved documents
    const context = relevantDocs
      .map((doc, index) => `Document ${index + 1} (from ${doc.fileName}):\n${doc.text}`)
      .join('\n\n');

    // Step 4: Generate response using context
    console.log('Generating response...');
    const response = await generateResponse(message, context);

    // Step 5: Return response with metadata
    return NextResponse.json({
      success: true,
      response: response,
      sources: relevantDocs.map(doc => ({
        fileName: doc.fileName,
        score: doc.score,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
