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

    // TODO: 실제 데이터베이스에서 가입 대기 중인 사용자들을 가져오는 로직
    // 여기서는 임시 데이터를 반환합니다
    const pendingUsers = [
      {
        id: '1',
        name: '김요양',
        email: 'kim@example.com',
        role: 'caregiver',
        requestedAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: '이사무',
        email: 'lee@example.com',
        role: 'office',
        requestedAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json(pendingUsers);
  } catch (error) {
    console.error('가입 대기 사용자 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 