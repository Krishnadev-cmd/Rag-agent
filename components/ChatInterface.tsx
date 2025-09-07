'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sourceFile?: string;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(true);

  // Load the current latest file on component mount
  useEffect(() => {
    const loadLatestFile = async () => {
      try {
        const response = await fetch('/api/latest-file');
        const data = await response.json();
        
        if (data.success && data.latestFile) {
          setCurrentFile(data.latestFile);
        }
      } catch (error) {
        console.error('Failed to load latest file:', error);
      } finally {
        setLoadingFile(false);
      }
    };

    loadLatestFile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          isUser: false,
          timestamp: new Date(),
          sourceFile: data.sourceFile,
        };
        setMessages(prev => [...prev, botMessage]);
        
        // Update current file if it changed
        if (data.sourceFile && data.sourceFile !== currentFile) {
          setCurrentFile(data.sourceFile);
        }
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-96 max-w-2xl mx-auto border rounded-lg bg-white shadow-lg">
      {/* Header showing current file */}
      <div className="border-b p-3 bg-gray-50 rounded-t-lg">
        <div className="text-sm text-gray-600">
          {loadingFile ? (
            <span>Loading current document...</span>
          ) : currentFile ? (
            <span>
              📄 Currently using: <span className="font-medium text-gray-800">{currentFile}</span>
            </span>
          ) : (
            <span className="text-orange-600">⚠️ No documents available. Please upload a document first.</span>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500">
            Start a conversation! Ask me anything about your uploaded documents.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <div className="text-xs opacity-70 mt-1">
                  <div>{message.timestamp.toLocaleTimeString()}</div>
                  {message.sourceFile && !message.isUser && (
                    <div className="text-xs text-gray-500 mt-1">
                      📄 Source: {message.sourceFile}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your documents..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim() || isLoading}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
