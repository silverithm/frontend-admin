import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('Authorization');

    // companyId를 body에서 분리
    const { companyId, ...requestBody } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: '회사 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // companyId를 숫자로 변환
    const numericCompanyId = parseInt(companyId, 10);
    if (isNaN(numericCompanyId)) {
      return NextResponse.json(
        { error: '유효하지 않은 회사 ID입니다.' },
        { status: 400 }
      );
    }

    console.log('Backend API 호출:', {
      url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vacation/admin/submit-for-member?companyId=${numericCompanyId}`,
      body: requestBody
    });

    // companyId는 Query Parameter로, 나머지는 Body로 전송
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/vacation/admin/submit-for-member?companyId=${numericCompanyId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader }),
        },
        body: JSON.stringify(requestBody), // companyId가 제거된 requestBody만 전송
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || '휴무 신청에 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin vacation submission error:', error);
    return NextResponse.json(
      { error: '휴무 신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}