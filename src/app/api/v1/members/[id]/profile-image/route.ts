import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// 프로필 사진 업로드 (multipart/form-data, field name: file)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();

    // Authorization 헤더 가져오기
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Content-Type은 FormData에서 자동 설정되므로 직접 지정하지 않는다.
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/members/${id}/profile-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!backendResponse.ok) {
      let errorBody: unknown;
      try {
        errorBody = await backendResponse.json();
      } catch {
        errorBody = { error: `백엔드 서버 오류: ${backendResponse.status}` };
      }
      return NextResponse.json(errorBody, { status: backendResponse.status, headers: corsHeaders });
    }

    const data = await backendResponse.json();
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error('[Member Profile Image API] POST 오류:', error);
    return NextResponse.json(
      { error: '프로필 사진 업로드 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// 프로필 사진 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/members/${id}/profile-image`, {
      method: 'DELETE',
      headers,
    });

    if (!backendResponse.ok) {
      let errorBody: unknown;
      try {
        errorBody = await backendResponse.json();
      } catch {
        errorBody = { error: `백엔드 서버 오류: ${backendResponse.status}` };
      }
      return NextResponse.json(errorBody, { status: backendResponse.status, headers: corsHeaders });
    }

    // 백엔드가 빈 응답(204 등)을 줄 수도 있으므로 안전하게 파싱한다.
    const text = await backendResponse.text();
    const data = text ? JSON.parse(text) : {};
    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error('[Member Profile Image API] DELETE 오류:', error);
    return NextResponse.json(
      { error: '프로필 사진 삭제 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
