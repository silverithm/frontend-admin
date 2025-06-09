import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authorization 헤더 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return NextResponse.json({ error: '유효한 상태값이 필요합니다. (active, inactive)' }, { status: 400 });
    }

    // 백엔드 API 호출 - 사용자 상태 변경
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const apiUrl = `${backendUrl}/api/v1/members/${userId}`;

    console.log('[Update User Status API] 백엔드 API 호출:', apiUrl);

    const backendResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        status
      }),
    });

    if (!backendResponse.ok) {
      console.error('[Update User Status API] 백엔드 응답 오류:', backendResponse.status, backendResponse.statusText);
      const errorText = await backendResponse.text();
      console.error('[Update User Status API] 오류 상세:', errorText);
      return NextResponse.json(
        { error: '사용자 상태 변경에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    console.log('[Update User Status API] 백엔드 응답 데이터:', data);

    return NextResponse.json({ 
      message: '사용자 상태가 변경되었습니다.',
      userId,
      status,
      user: data
    });
  } catch (error) {
    console.error('[Update User Status API] 사용자 상태 변경 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 