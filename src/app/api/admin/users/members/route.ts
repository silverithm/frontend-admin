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

export async function GET(request: NextRequest) {
  try {
    const tokenPayload = verifyToken(request);
    
    if (!tokenPayload) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 현재 사용자가 관리자인지 확인
    if (tokenPayload.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // TODO: 실제 데이터베이스에서 승인된 회원들을 가져오는 로직
    // 여기서는 임시 데이터를 반환합니다
    const members = [
      {
        id: '3',
        name: '박간호',
        email: 'park@example.com',
        role: 'caregiver',
        status: 'active',
        approvedAt: new Date(Date.now() - 86400000).toISOString(), // 1일 전
        lastLoginAt: new Date().toISOString(),
      },
      {
        id: '4',
        name: '최관리',
        email: 'choi@example.com',
        role: 'office',
        status: 'active',
        approvedAt: new Date(Date.now() - 172800000).toISOString(), // 2일 전
        lastLoginAt: new Date(Date.now() - 3600000).toISOString(), // 1시간 전
      },
      {
        id: '5',
        name: '정비활',
        email: 'jung@example.com',
        role: 'caregiver',
        status: 'inactive',
        approvedAt: new Date(Date.now() - 259200000).toISOString(), // 3일 전
        lastLoginAt: new Date(Date.now() - 86400000).toISOString(), // 1일 전
      },
    ];

    return NextResponse.json({ users: members });
  } catch (error) {
    console.error('회원 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 