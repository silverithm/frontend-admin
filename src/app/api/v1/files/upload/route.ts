import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const category = request.nextUrl.searchParams.get('category') || 'templates';

    // Authorization 헤더 가져오기
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 요청 헤더 설정 (Content-Type은 FormData에서 자동 설정)
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/files/upload?category=${category}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] File upload error:', error);
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
