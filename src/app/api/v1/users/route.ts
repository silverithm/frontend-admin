import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

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

    return NextResponse.json({
      message: responseText || 'success'
    }, { 
      status: 200,
      headers 
    });
  } catch (error) {
    console.error('회원탈퇴 API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}