import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 이관 색인 양식(엑셀) 내려받기
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId 파라미터가 필요합니다.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const backendHeaders: Record<string, string> = {};
    if (authHeader) backendHeaders['Authorization'] = authHeader;

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/v1/approvals/import/template?companyId=${companyId}`,
      { headers: backendHeaders },
    );

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: '양식을 내려받지 못했습니다.' },
        { status: backendResponse.status },
      );
    }

    const blob = await backendResponse.blob();
    const responseHeaders = new Headers();
    const contentType = backendResponse.headers.get('content-type');
    const contentDisposition = backendResponse.headers.get('content-disposition');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    if (contentDisposition) responseHeaders.set('Content-Disposition', contentDisposition);

    return new NextResponse(blob, { headers: responseHeaders });
  } catch (error) {
    console.error('[ApprovalImportTemplate API] GET 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
