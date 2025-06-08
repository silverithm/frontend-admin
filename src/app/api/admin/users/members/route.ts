import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // URL 파라미터에서 companyId 가져오기
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId가 필요합니다.' }, { status: 400 });
    }

    // 백엔드 API 호출
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    let apiUrl = `${backendUrl}/api/v1/members?companyId=${companyId}`;
    
    if (role) {
      apiUrl += `&role=${role}`;
    }
    if (status) {
      apiUrl += `&status=${status}`;
    }

    console.log('[Members API] 백엔드 API 호출:', apiUrl);

    const backendResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!backendResponse.ok) {
      console.error('[Members API] 백엔드 응답 오류:', backendResponse.status, backendResponse.statusText);
      return NextResponse.json(
        { error: '회원 목록을 가져오는데 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    console.log('[Members API] 백엔드 응답 데이터:', data);

    // 백엔드에서 온 데이터를 프론트엔드 형식에 맞게 변환
    const members = (data.members || []).map((member: any) => ({
      id: member.id?.toString(),
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      phone: member.phoneNumber,
      department: member.department,
      position: member.position,
      approvedAt: member.createdAt,
      lastLoginAt: member.updatedAt,
    }));

    return NextResponse.json({ users: members });
  } catch (error) {
    console.error('[Members API] 회원 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 