import { Button } from "@/components/ui/button";
import Input_button from "@/components/Input_button";
import ChatInterface from "@/components/ChatInterface";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            RAG Chatbot
          </h1>
          <p className="text-gray-600">
            Upload documents and ask questions about their content
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Upload Documents</h2>
          <Input_button />
        </div>

        {/* Chat Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Ask Questions</h2>
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
