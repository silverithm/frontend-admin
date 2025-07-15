import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

export async function DELETE(request: NextRequest) {
  try {
    // Authorization 헤더 가져오기
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    // 백엔드로 요청 전달
    const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'ngrok-skip-browser-warning': 'true',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: responseText || '회원탈퇴에 실패했습니다.' },
        { status: response.status }
      );
    }

    return new NextResponse(responseText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('회원탈퇴 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}