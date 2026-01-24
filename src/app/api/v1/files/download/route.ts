import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get('path');
    const fileName = request.nextUrl.searchParams.get('fileName');

    if (!path) {
      return NextResponse.json({ error: '파일 경로가 필요합니다.' }, { status: 400 });
    }

    console.log('[File Download] Requesting path:', path);

    const url = new URL(`${BACKEND_URL}/api/v1/files/download`);
    url.searchParams.set('path', path);
    if (fileName) {
      url.searchParams.set('fileName', fileName);
    }

    console.log('[File Download] Backend URL:', url.toString());

    // Authorization 헤더 가져오기
    const authHeader = request.headers.get('authorization');
    const requestHeaders: Record<string, string> = {};
    if (authHeader) {
      requestHeaders['Authorization'] = authHeader;
    }

    const response = await fetch(url.toString(), { headers: requestHeaders });

    console.log('[File Download] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[File Download] Backend error:', errorText);
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.', detail: errorText },
        { status: response.status }
      );
    }

    const blob = await response.blob();
    const responseHeaders = new Headers();

    // 원본 응답 헤더 복사
    const contentType = response.headers.get('content-type');
    const contentDisposition = response.headers.get('content-disposition');

    if (contentType) responseHeaders.set('Content-Type', contentType);
    if (contentDisposition) responseHeaders.set('Content-Disposition', contentDisposition);

    return new NextResponse(blob, { headers: responseHeaders });
  } catch (error) {
    console.error('[API Proxy] File download error:', error);
    return NextResponse.json(
      { error: '파일 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
