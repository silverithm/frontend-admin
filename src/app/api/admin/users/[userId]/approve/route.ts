import { NextRequest, NextResponse } from 'next/server';

export async function POST(
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

    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    // 관리자 ID 가져오기 (localStorage에서)
    const body = await request.json().catch(() => ({}));
    const adminId = body.adminId || 'admin'; // 기본값 설정

    // 백엔드 API 호출 - 가입 요청 승인
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${backendUrl}/api/v1/members/join-requests/${userId}/approve?adminId=${adminId}`;

    console.log('[Approve User API] 백엔드 API 호출:', apiUrl);

    const backendResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!backendResponse.ok) {
      console.error('[Approve User API] 백엔드 응답 오류:', backendResponse.status, backendResponse.statusText);
      const errorText = await backendResponse.text();
      console.error('[Approve User API] 오류 상세:', errorText);
      return NextResponse.json(
        { error: '사용자 승인에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    console.log('[Approve User API] 백엔드 응답 데이터:', data);

    return NextResponse.json({ 
      message: '사용자가 승인되었습니다.',
      userId,
      user: data
    });
  } catch (error) {
    console.error('[Approve User API] 사용자 승인 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 