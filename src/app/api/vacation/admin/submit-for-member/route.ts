import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // companyId를 body에서 분리
    const { companyId, ...requestBody } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: '회사 ID가 필요합니다.' },
        { status: 400, headers }
      );
    }

    // companyId를 숫자로 변환
    const numericCompanyId = parseInt(companyId, 10);
    if (isNaN(numericCompanyId)) {
      return NextResponse.json(
        { error: '유효하지 않은 회사 ID입니다.' },
        { status: 400, headers }
      );
    }

    const apiUrl = `${BACKEND_URL}/api/vacation/admin/submit-for-member?companyId=${numericCompanyId}`;

    console.log('Backend API 호출:', {
      url: apiUrl,
      body: requestBody
    });

    // 백엔드로 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    // companyId는 Query Parameter로, 나머지는 Body로 전송
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(requestBody), // companyId가 제거된 requestBody만 전송
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', response.status, errorText);
      const errorData = JSON.parse(errorText || '{}');
      return NextResponse.json(
        { error: errorData.message || '휴무 신청에 실패했습니다.' },
        { status: response.status, headers }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Admin vacation submission error:', error);
    return NextResponse.json(
      { error: '휴무 신청 처리 중 오류가 발생했습니다.' },
      { status: 500, headers }
    );
  }
}