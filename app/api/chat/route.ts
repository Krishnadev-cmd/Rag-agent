// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Function to create embedding for user query using Gemini
async function createQueryEmbedding(query: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent(query);
    const embedding = result.embedding;
    
    if (!embedding || !embedding.values) {
      throw new Error('No embedding found in Gemini response');
    }
    
    return embedding.values;
  } catch (error) {
    console.error('Error creating query embedding with Gemini:', error);
    throw new Error('Failed to create query embedding with Gemini API');
  }
}

// Function to retrieve relevant documents from vector database, optionally filtered by file
async function retrieveRelevantDocs(queryEmbedding: number[], topK: number = 5, fileName?: string) {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'rag-gemini-768');
    
    const queryOptions: any = {
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
      includeValues: false,
    };

    // Add filter if fileName is specified
    if (fileName) {
      queryOptions.filter = {
        fileName: { $eq: fileName }
      };
    }

    const queryResponse = await index.query(queryOptions);

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

// Function to get the latest uploaded file
async function getLatestFile(): Promise<string | null> {
  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME || 'rag-gemini-768');
    
    // Use a simple query to get vectors with metadata
    // We'll query with a zero vector to get any matches with metadata
    const queryResponse = await index.query({
      vector: new Array(768).fill(0.001), // Small non-zero values instead of zeros
      topK: 10000,
      includeMetadata: true,
      includeValues: false,
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      console.log('No vectors found in the index');
      return null;
    }

    console.log(`Found ${queryResponse.matches.length} vectors in the index`);

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

    console.log(`Found ${fileMap.size} unique files:`, Array.from(fileMap.keys()));

    if (fileMap.size === 0) {
      console.log('No valid files found with proper metadata');
      return null;
    }

    // Find the latest file
    let latestFile: { fileName: string; uploadedAt: Date } | null = null;
    
    for (const fileInfo of fileMap.values()) {
      if (!latestFile || fileInfo.uploadedAt > latestFile.uploadedAt) {
        latestFile = fileInfo;
      }
    }

    console.log(`Latest file determined: ${latestFile?.fileName} uploaded at ${latestFile?.uploadedAt}`);
    return latestFile?.fileName || null;
  } catch (error) {
    console.error('Error getting latest file:', error);
    return null;
  }
}

// Function to generate response using Gemini
async function generateResponse(query: string, context: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are a helpful assistant that answers questions based on the provided context. 
Use only the information from the context to answer questions. 
If the context doesn't contain enough information to answer the question, 
say so politely and ask for clarification.

Context:
${context}

Question: ${query}

Answer:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error('Error generating response with Gemini:', error);
    throw new Error('Failed to generate response with Gemini API');
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

    // Step 1: Get the latest uploaded file
    console.log('Getting latest uploaded file...');
    const latestFileName = await getLatestFile();
    
    if (!latestFileName) {
      return NextResponse.json({
        success: true,
        response: "I don't have any documents in my knowledge base. Please upload a document first.",
      });
    }

    console.log(`Using latest file: ${latestFileName}`);

    // Step 2: Create embedding for user query
    console.log('Creating query embedding...');
    const queryEmbedding = await createQueryEmbedding(message);

    // Step 3: Retrieve relevant documents from the latest file only
    console.log('Retrieving relevant documents from latest file...');
    const relevantDocs = await retrieveRelevantDocs(queryEmbedding, 5, latestFileName);

    if (relevantDocs.length === 0) {
      return NextResponse.json({
        success: true,
        response: `I don't have any relevant information in the latest document (${latestFileName}) to answer your question. The document might not contain content related to your query.`,
      });
    }

    // Step 4: Prepare context from retrieved documents
    const context = relevantDocs
      .map((doc, index) => `Section ${index + 1}:\n${doc.text}`)
      .join('\n\n');

    // Step 5: Generate response using context
    console.log('Generating response...');
    const response = await generateResponse(message, context);

    // Step 6: Return response with metadata
    return NextResponse.json({
      success: true,
      response: response,
      sourceFile: latestFileName,
      relevantSections: relevantDocs.length,
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
