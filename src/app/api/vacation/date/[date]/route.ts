import { NextRequest, NextResponse } from 'next/server';

// 백엔드 API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 기본 CORS 및 캐시 방지 헤더 설정
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// OPTIONS 요청에 대한 핸들러 추가
export async function OPTIONS() {
  return NextResponse.json({}, { headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    // URL에서 날짜 파라미터 추출
    const { date: dateParam } = await params;
    // role 파라미터 추출
    const roleParam = request.nextUrl.searchParams.get('role');
    const role = (roleParam === 'all' || roleParam === 'caregiver' || roleParam === 'office') 
      ? roleParam : 'caregiver';
    
    // nameFilter 파라미터 추출
    const nameFilter = request.nextUrl.searchParams.get('nameFilter');
    
    // companyId 파라미터 추출
    const companyId = request.nextUrl.searchParams.get('companyId');

    console.log(`[Frontend API] 날짜 ${dateParam}에 대한 휴가 요청 조회 프록시 시작 (role=${role}, nameFilter=${nameFilter || 'none'}, companyId=${companyId})`);

    // 유효한 날짜 형식인지 확인
    if (!dateParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error(`[Frontend API] 잘못된 날짜 형식: ${dateParam}`);
      return NextResponse.json({ error: '잘못된 날짜 형식입니다.' }, { 
        status: 400, 
        headers 
      });
    }

    if (!companyId) {
      return NextResponse.json({
        error: 'companyId 파라미터가 필요합니다.'
      }, { status: 400, headers });
    }

    // JWT 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 백엔드 API URL 구성 (companyId 포함)
    let backendUrl = `${BACKEND_URL}/api/vacation/date/${dateParam}?companyId=${companyId}`;
    
    // role이 'all'이 아닌 경우에만 role 파라미터 추가
    if (role !== 'all') {
      backendUrl += `&role=${role}`;
    }
    
    if (nameFilter) {
      backendUrl += `&nameFilter=${encodeURIComponent(nameFilter)}`;
    }

    console.log(`[Frontend API] 백엔드 요청 URL: ${backendUrl}`);

    // 백엔드 요청 헤더 구성
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // JWT 토큰이 있으면 Authorization 헤더 추가
    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    let data;

    // role이 'all'인 경우 caregiver와 office 데이터를 모두 가져와서 합치기
    if (role === 'all') {
      console.log(`[Frontend API] role=all이므로 caregiver와 office 데이터를 모두 가져옵니다.`);
      
      try {
        // caregiver 데이터 요청
        let caregiverUrl = `${BACKEND_URL}/api/vacation/date/${dateParam}?companyId=${companyId}&role=caregiver`;
        if (nameFilter) {
          caregiverUrl += `&nameFilter=${encodeURIComponent(nameFilter)}`;
        }
        
        const caregiverResponse = await fetch(caregiverUrl, {
          method: 'GET',
          headers: backendHeaders,
        });
        
        // office 데이터 요청
        let officeUrl = `${BACKEND_URL}/api/vacation/date/${dateParam}?companyId=${companyId}&role=office`;
        if (nameFilter) {
          officeUrl += `&nameFilter=${encodeURIComponent(nameFilter)}`;
        }
        
        const officeResponse = await fetch(officeUrl, {
          method: 'GET',
          headers: backendHeaders,
        });

        if (!caregiverResponse.ok || !officeResponse.ok) {
          console.error(`[Frontend API] 백엔드 응답 오류 - caregiver: ${caregiverResponse.status}, office: ${officeResponse.status}`);
          return NextResponse.json({
            error: `백엔드 서버 오류`
          }, { status: 500, headers });
        }

        const caregiverData = await caregiverResponse.json();
        const officeData = await officeResponse.json();
        
        console.log(`[Frontend API] caregiver 데이터:`, caregiverData);
        console.log(`[Frontend API] office 데이터:`, officeData);

        // 두 데이터를 합치기
        data = {
          date: dateParam,
          vacations: [
            ...(caregiverData.vacations || []),
            ...(officeData.vacations || [])
          ],
          totalVacationers: (caregiverData.totalVacationers || 0) + (officeData.totalVacationers || 0),
          maxPeople: Math.max(caregiverData.maxPeople || 0, officeData.maxPeople || 0)
        };
        
        console.log(`[Frontend API] 합쳐진 데이터:`, data);
        
      } catch (error) {
        console.error('[Frontend API] role=all 처리 중 오류:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { 
          status: 500, 
          headers 
        });
      }
    } else {
      // 단일 role 요청
      const backendResponse = await fetch(backendUrl, {
        method: 'GET',
        headers: backendHeaders,
      });

      if (!backendResponse.ok) {
        console.error(`[Frontend API] 백엔드 응답 오류: ${backendResponse.status} ${backendResponse.statusText}`);
        return NextResponse.json({
          error: `백엔드 서버 오류: ${backendResponse.status}`
        }, { status: backendResponse.status, headers });
      }

      data = await backendResponse.json();
    }
    
    console.log(`[Frontend API] 날짜 ${dateParam} 백엔드 응답 성공: ${data.totalVacationers || 0}명의 휴가자`);
    console.log(`[Frontend API] 백엔드 응답 전체 데이터:`, JSON.stringify(data, null, 2));
    
    // vacations 배열에 duration 필드가 있는지 확인
    if (data.vacations && Array.isArray(data.vacations) && data.vacations.length > 0) {
      console.log(`[Frontend API] 첫 번째 휴가 객체:`, data.vacations[0]);
      console.log(`[Frontend API] 첫 번째 휴가의 duration:`, data.vacations[0].duration);
      console.log(`[Frontend API] 모든 휴가의 duration 정보:`, 
        data.vacations.map((v: any, i: number) => ({
          index: i,
          userName: v.userName,
          duration: v.duration,
          hasDuration: 'duration' in v
        }))
      );
    } else {
      console.log(`[Frontend API] 휴가 데이터가 없거나 배열이 아닙니다:`, data.vacations);
    }
    
    return NextResponse.json(data, { 
      status: 200, 
      headers 
    });
      
  } catch (error) {
    console.error('[Frontend API] 오류 발생:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { 
      status: 500, 
      headers 
    });
  }
} 