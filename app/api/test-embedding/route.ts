// app/api/test-embedding/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing OpenAI embedding creation...');

    const testText = "This is a simple test text for embedding creation.";

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: testText,
      }),
    });

    const responseText = await response.text();
    console.log('Raw response:', responseText);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}`,
        details: responseText,
      });
    }

    const data = JSON.parse(responseText);
    console.log('Parsed response:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Embedding creation test successful!',
      hasData: !!data.data,
      dataLength: data.data?.length || 0,
      hasEmbedding: !!(data.data && data.data[0] && data.data[0].embedding),
      embeddingLength: data.data?.[0]?.embedding?.length || 0,
    });

  } catch (error) {
    console.error('Test embedding error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to test embedding creation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
