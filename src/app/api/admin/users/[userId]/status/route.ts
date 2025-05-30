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

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const tokenPayload = verifyToken(request);
    
    if (!tokenPayload) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 현재 사용자가 관리자인지 확인
    if (tokenPayload.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { userId } = params;
    const body = await request.json();
    const { status } = body;

    // 상태 값 검증
    if (!status || !['active', 'inactive'].includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태값입니다.' }, { status: 400 });
    }

    // TODO: 실제 데이터베이스에서 사용자 상태 변경 로직
    // 1. 사용자 상태를 새로운 값으로 변경
    // 2. 변경 날짜 기록

    console.log(`사용자 ${userId} 상태를 ${status}로 변경`);

    return NextResponse.json({ 
      message: `사용자 상태가 ${status}로 변경되었습니다.`,
      userId,
      status
    });
  } catch (error) {
    console.error('사용자 상태 변경 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 