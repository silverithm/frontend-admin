import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function PUT() {
  try {
    const headersList = await headers();
    const authToken = headersList.get('authorization')?.replace('Bearer ', '');

    if (!authToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    
    if (!backendUrl) {
      console.error('NEXT_PUBLIC_API_URL is not configured');
      return NextResponse.json(
        { message: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${backendUrl}/api/v1/subscriptions/activate`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse response JSON:', jsonError);
      data = { message: 'Failed to parse response from backend' };
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error activating subscription:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}