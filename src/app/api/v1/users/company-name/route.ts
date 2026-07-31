import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// 기관명 변경
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) backendHeaders['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/company-name`, {
      method: 'PUT',
      headers: backendHeaders,
      body: await request.text(),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => '');
      return NextResponse.json(
        { error: errorText || `백엔드 서버 오류: ${backendResponse.status}` },
        { status: backendResponse.status, headers },
      );
    }

    // 백엔드는 "success" 문자열을 반환
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error('[CompanyName API] PUT 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
