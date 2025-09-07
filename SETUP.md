# RAG Chatbot Setup Guide

This is a complete RAG (Retrieval Augmented Generation) chatbot built with Next.js, OpenAI, and Pinecone.

## Features

- ✅ Document upload (PDF, TXT, MD)
- ✅ Text chunking and embedding generation
- ✅ Vector storage with Pinecone
- ✅ Semantic search and retrieval
- ✅ Chat interface with context-aware responses
- ✅ Source attribution

## Required Setup

### 1. Environment Variables

Create a `.env.local` file with:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=rag-documents
```

### 2. OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up/Login and go to API Keys
3. Create a new API key
4. Add it to your `.env.local` file

### 3. Pinecone Setup

1. Go to [Pinecone](https://www.pinecone.io/)
2. Sign up for a free account
3. Create a new index with:
   - **Name**: `rag-documents`
   - **Dimensions**: `1536` (for OpenAI text-embedding-3-small)
   - **Metric**: `cosine`
4. Get your API key from the dashboard
5. Add both to your `.env.local` file

### 4. Install Dependencies

All dependencies are already installed, but if you need to reinstall:

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

## How to Use

1. **Upload Documents**: Use the upload section to add PDF or text files
2. **Wait for Processing**: The system will chunk the text, create embeddings, and store them
3. **Ask Questions**: Use the chat interface to ask questions about your uploaded content
4. **Get AI Responses**: The system will find relevant chunks and generate contextual answers

## Architecture

```
Document Upload → Text Extraction → Chunking → Embeddings → Vector DB Storage
                                                                      ↓
User Question → Query Embedding → Similarity Search → Context Retrieval → AI Response
```

## Supported File Types

- PDF files (.pdf)
- Text files (.txt)
- Markdown files (.md)
- Word documents (.doc, .docx) - basic support

## Troubleshooting

### Common Issues

1. **"Failed to create embeddings"**
   - Check your OpenAI API key
   - Ensure you have credits in your OpenAI account

2. **"Failed to store in vector database"**
   - Verify your Pinecone API key
   - Check that your index exists and has correct dimensions (1536)

3. **"No relevant documents found"**
   - Make sure you've uploaded and processed documents first
   - Try rephrasing your question

### Environment Variables Not Loading

Make sure your `.env.local` file is in the root directory (same level as `package.json`).

## Costs

- **OpenAI**: ~$0.0001 per 1K tokens (embeddings) + ~$0.002 per 1K tokens (chat)
- **Pinecone**: Free tier includes 1M vectors

## Next Steps

- Add document management (view/delete uploaded docs)
- Support for more file types
- Better chunking strategies
- Conversation memory
- User authentication
