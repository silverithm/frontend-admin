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

export async function DELETE(
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

    // 자기 자신을 삭제하려고 하는지 확인
    if (tokenPayload.userId === userId) {
      return NextResponse.json({ error: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 });
    }

    // TODO: 실제 데이터베이스에서 사용자 삭제 로직
    // 1. 사용자와 관련된 모든 데이터 확인 (휴무 기록 등)
    // 2. 사용자 삭제 또는 비활성화
    // 3. 관련 데이터 처리 (보관 또는 삭제)

    console.log(`사용자 ${userId} 삭제 처리`);

    return NextResponse.json({ 
      message: '사용자가 삭제되었습니다.',
      userId 
    });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 