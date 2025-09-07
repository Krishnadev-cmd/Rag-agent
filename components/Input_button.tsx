'use client'

import React from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useState } from 'react'

const Input_button = () => {
  const [fileName, setFileName] = useState('set File Name');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useMockEmbeddings, setUseMockEmbeddings] = useState(false);
  const [useSafeMode, setUseSafeMode] = useState(true);
  const [useBatchMode, setUseBatchMode] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  }

  const handleFileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      let fileText: string;

      // Handle different file types
      if (file.type === 'application/pdf') {
        // Parse PDF file
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const pdfResponse = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData,
          });
          
          const pdfResult = await pdfResponse.json();
          if (!pdfResult.success) {
            // Try alternative PDF parsing or suggest text extraction
            throw new Error(pdfResult.error || 'Failed to parse PDF. Try converting to text first or copy-paste the content.');
          }
          fileText = pdfResult.text;
          
          // Validate extracted text
          if (!fileText || fileText.trim().length < 10) {
            throw new Error('PDF appears to be empty or text could not be extracted. Try a different PDF or convert to text format.');
          }
          
        } catch (pdfError) {
          console.error('PDF parsing failed:', pdfError);
          throw new Error(
            `PDF parsing failed: ${(pdfError as Error).message}\n\n` +
            'Suggestions:\n' +
            '• Try converting the PDF to a .txt file\n' +
            '• Copy and paste the text content directly\n' +
            '• Ensure the PDF contains selectable text (not just images)'
          );
        }
      } else {
        // Handle text files
        fileText = await readFileContent(file);
        
        // Validate text content
        if (!fileText || fileText.trim().length < 10) {
          throw new Error('File appears to be empty or unreadable. Please check the file content.');
        }
      }
      
      // Send to processing API
      let endpoint = '/api/process-document';
      if (useMockEmbeddings) {
        endpoint = '/api/process-document-mock';
      } else if (useBatchMode) {
        endpoint = '/api/process-document-batch';
      } else if (useSafeMode) {
        endpoint = '/api/process-document-safe';
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          content: fileText,
          fileType: file.type,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Document processed successfully:', result);
        alert(`Successfully processed ${result.chunkCount} chunks from ${result.fileName}`);
      } else {
        throw new Error(result.error || 'Processing failed');
      }
      
      // Reset form after successful upload
      setFile(null);
      setFileName('set File Name');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Helper function to read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  return (
    <div className='flex flex-col gap-4 max-w-md'>
      <form onSubmit={handleFileSubmit} className='flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <Input 
            type="file" 
            onChange={handleFileChange} 
            placeholder={`${fileName}`}
            disabled={uploading}
            accept=".txt,.pdf,.md,.doc,.docx"
          />
          <div className='flex items-center gap-2'>
            <input
              type="checkbox"
              id="useMock"
              checked={useMockEmbeddings}
              onChange={(e) => setUseMockEmbeddings(e.target.checked)}
              disabled={uploading}
            />
            <label htmlFor="useMock" className='text-sm text-gray-600'>
              Use mock embeddings (no Gemini API calls required)
            </label>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type="checkbox"
              id="useBatch"
              checked={useBatchMode}
              onChange={(e) => setUseBatchMode(e.target.checked)}
              disabled={uploading || useMockEmbeddings}
            />
            <label htmlFor="useBatch" className='text-sm text-gray-600'>
              Use batch mode (faster processing, recommended for large files)
            </label>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type="checkbox"
              id="useSafe"
              checked={useSafeMode}
              onChange={(e) => setUseSafeMode(e.target.checked)}
              disabled={uploading || useMockEmbeddings || useBatchMode}
            />
            <label htmlFor="useSafe" className='text-sm text-gray-600'>
              Use safe mode (smaller chunks, slower but more reliable)
            </label>
          </div>
        </div>
        <Button 
          type="submit" 
          disabled={!file || uploading}
          className='w-full'
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </form>
    </div>
  )
}

export default Input_button