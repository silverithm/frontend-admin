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

async function passThrough(backendResponse: Response) {
  const text = await backendResponse.text().catch(() => '');
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = backendResponse.ok
      ? {}
      : { error: text || `백엔드 서버 오류: ${backendResponse.status}` };
  }
  return NextResponse.json(body, { status: backendResponse.status, headers: corsHeaders });
}

// 관리자 본인 프로필 사진 등록/교체 (multipart/form-data, field name: file)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Content-Type은 FormData가 boundary와 함께 정한다 — 직접 지정하면 업로드가 깨진다
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/profile-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return passThrough(backendResponse);
  } catch (error) {
    console.error('[AdminProfileImage API] POST 오류:', error);
    return NextResponse.json(
      { error: '프로필 사진 업로드 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders },
    );
  }
}

// 관리자 본인 프로필 사진 삭제
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/users/profile-image`, {
      method: 'DELETE',
      headers,
    });

    return passThrough(backendResponse);
  } catch (error) {
    console.error('[AdminProfileImage API] DELETE 오류:', error);
    return NextResponse.json(
      { error: '프로필 사진 삭제 중 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders },
    );
  }
}
