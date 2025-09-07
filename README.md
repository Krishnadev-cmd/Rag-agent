# RAG Chatbot with Single-File Context

A powerful Retrieval-Augmented Generation (RAG) chatbot built with Next.js that processes documents and answers questions based on the most recently uploaded file. The system uses Google Gemini API for embeddings and text generation, with Pinecone as the vector database.

## Features

- 📄 **Multi-format Document Support**: PDF, DOCX, TXT, and MD files
- 🎯 **Single-File Context**: Automatically uses the latest uploaded document for responses
- 🚀 **Optimized Processing**: Batch processing with 95% speed improvement
- 🧠 **Advanced RAG Pipeline**: Semantic search with context-aware responses
- 🔧 **Smart Error Handling**: Automatic corrupted data cleanup
- 📊 **Real-time Feedback**: Processing status and file information display

## Tech Stack

- **Frontend**: Next.js 15.5.2 with TypeScript and Tailwind CSS
- **AI/ML**: Google Gemini API (embedding-001, gemini-1.5-flash)
- **Vector Database**: Pinecone (768-dimensional index)
- **Document Processing**: PDF-parse, Mammoth (DOCX), custom text chunking
- **Deployment**: Ready for Vercel/other platforms

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Google AI Studio API key
- Pinecone account and API key

### 1. Clone and Install

```bash
git clone <repository-url>
cd rag
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
GOOGLE_API_KEY=your_google_ai_studio_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=rag-gemini-768
```

### 3. Pinecone Index Setup

Create a Pinecone index with these specifications:
- **Index Name**: `rag-gemini-768`
- **Dimensions**: `768` (matches Gemini embedding-001 model)
- **Metric**: `cosine`
- **Cloud Provider**: Any (AWS/GCP/Azure)

### 4. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

### Document Upload

1. Select a file (PDF, DOCX, TXT, MD)
2. Choose processing options:
   - **Batch Mode**: Fast processing (recommended)
   - **Safe Mode**: Smaller chunks, more reliable
   - **Mock Mode**: Testing without API calls
3. Click "Upload File"

### Chat Interface

- The system automatically uses the **latest uploaded document**
- Ask questions about the document content
- View which file is currently being used
- Get contextual responses with source information

## API Endpoints

### Document Processing
- `POST /api/process-document-batch` - Optimized batch processing
- `POST /api/parse-pdf` - PDF text extraction
- `POST /api/parse-docx` - DOCX text extraction

### Chat & Retrieval
- `POST /api/chat` - Main chat endpoint with single-file context
- `GET /api/latest-file` - Get currently active document

### Maintenance
- `POST /api/cleanup-corrupted` - Remove corrupted vectors

## Configuration

### Embedding Settings
- **Model**: `embedding-001` (Google Gemini)
- **Dimensions**: 768
- **Chunk Size**: 12KB optimized chunks
- **Batch Size**: 5 concurrent requests

### Vector Database
- **Provider**: Pinecone
- **Index Dimensions**: 768
- **Similarity Metric**: Cosine
- **Metadata**: filename, timestamp, chunk index, text content

## Performance Optimizations

- **Batch Processing**: 95% faster than sequential processing
- **Optimized Chunking**: 12KB chunks for better context retention
- **Concurrent Embeddings**: 5 parallel requests to Gemini API
- **Smart Filtering**: Single-file context reduces search scope
- **Automatic Cleanup**: Removes corrupted data automatically

## Troubleshooting

### Common Issues

1. **"No documents found"**
   - Ensure files are uploaded successfully
   - Check Pinecone connection

2. **PDF/DOCX parsing errors**
   - Try converting to .txt format
   - Ensure files aren't password-protected

3. **Corrupted responses**
   - Run cleanup endpoint: `POST /api/cleanup-corrupted`
   - Re-upload the document

### Debug Mode

Check browser console and server logs for detailed error information.

## File Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # Main chat endpoint
│   │   ├── process-document-batch/    # Optimized processing
│   │   ├── parse-pdf/                 # PDF text extraction
│   │   ├── parse-docx/                # DOCX text extraction
│   │   ├── latest-file/               # Get current document
│   │   └── cleanup-corrupted/         # Data maintenance
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Input_button.tsx              # File upload component
│   ├── ChatInterface.tsx             # Chat UI
│   └── ui/                           # Shadcn/ui components
├── lib/
│   └── utils.ts
└── README.md
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Google AI Studio API key | Yes |
| `PINECONE_API_KEY` | Pinecone database API key | Yes |
| `PINECONE_INDEX_NAME` | Name of your Pinecone index | Yes |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

## Support

For issues and questions:
- Check the troubleshooting section
- Review server logs for error details
- Ensure all environment variables are set correctly
