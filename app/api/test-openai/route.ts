// app/api/test-openai/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing OpenAI API key...');
    console.log('API Key (first 10 chars):', process.env.OPENAI_API_KEY?.substring(0, 10));

    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `OpenAI API Error: ${response.status}`,
        details: data,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'OpenAI API key is working!',
      modelsCount: data.data?.length || 0,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to test OpenAI API',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
