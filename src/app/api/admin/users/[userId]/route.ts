import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

function verifyToken(request: NextRequest): JWTPayload | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    return decoded;
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    return null;
  }
}

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

// OPTIONS 요청에 대한 핸들러
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

// PUT: 사용자 승인/거부/상태변경
export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get('action'); // 'approve', 'reject', 또는 undefined
    const adminId = url.searchParams.get('adminId');

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    let backendUrl: string;
    let method = 'PUT';
    let body = null;

    // 사용자 상태 변경 요청인지 확인 (action이 없고 body에 status가 있는 경우)
    const requestBody = await request.json().catch(() => null);
    
    if (!action && requestBody?.status) {
      // 사용자 상태 변경
      backendUrl = `${BACKEND_URL}/api/v1/members/${userId}`;
      body = JSON.stringify(requestBody);
    } else if (action && adminId) {
      // 가입 승인/거부
      if (action === 'approve') {
        backendUrl = `${BACKEND_URL}/api/v1/members/join-requests/${userId}/approve?adminId=${adminId}`;
      } else if (action === 'reject') {
        backendUrl = `${BACKEND_URL}/api/v1/members/join-requests/${userId}/reject?adminId=${adminId}`;
        body = JSON.stringify(requestBody);
      } else {
        return NextResponse.json({
          error: '지원하지 않는 action입니다.'
        }, { status: 400, headers });
      }
    } else {
      return NextResponse.json({
        error: 'action과 adminId 파라미터가 필요하거나 status가 포함된 body가 필요합니다.'
      }, { status: 400, headers });
    }

    // 백엔드로 요청 전달
    const backendResponse = await fetch(backendUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      ...(body && { body }),
    });


    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('[Admin Proxy] 백엔드 오류 응답:', errorText);
      
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();

    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Admin Proxy] 요청 처리 중 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
}

// DELETE: 사용자 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');


    // 백엔드로 요청 전달
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/members/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });


    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('[Admin Proxy] 백엔드 오류 응답:', errorText);
      
      return NextResponse.json({
        error: `백엔드 서버 오류: ${backendResponse.status}`
      }, { status: backendResponse.status, headers });
    }

    const data = await backendResponse.json();

    return NextResponse.json(data, { headers });
      
  } catch (error) {
    console.error('[Admin Proxy] 요청 처리 중 오류:', error);
    return NextResponse.json({
      error: '서버 내부 오류가 발생했습니다.'
    }, { status: 500, headers });
  }
} 