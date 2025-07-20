import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  try {
    const headersList = await headers();
    const authToken = headersList.get('authorization')?.replace('Bearer ', '');

    if (!authToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    
    if (!backendUrl) {
      console.error('NEXT_PUBLIC_BACKEND_URL is not configured');
      return NextResponse.json(
        { message: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    console.log('Fetching subscription from:', `${backendUrl}/api/v1/subscriptions`);
    
    const response = await fetch(`${backendUrl}/api/v1/subscriptions`, {
      method: 'GET',
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
    
    console.log('Backend response status:', response.status);
    console.log('Backend response data:', data);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching subscription:', error);
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

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const authToken = headersList.get('authorization')?.replace('Bearer ', '');

    if (!authToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    
    if (!backendUrl) {
      console.error('NEXT_PUBLIC_BACKEND_URL is not configured');
      return NextResponse.json(
        { message: 'Backend URL not configured' },
        { status: 500 }
      );
    }

    console.log('Creating subscription at:', `${backendUrl}/api/v1/subscriptions`);
    console.log('Request body:', body);

    const response = await fetch(`${backendUrl}/api/v1/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body),
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Failed to parse response JSON:', jsonError);
      data = { message: 'Failed to parse response from backend' };
    }
    
    console.log('Backend response status:', response.status);
    console.log('Backend response data:', data);

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating subscription:', error);
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