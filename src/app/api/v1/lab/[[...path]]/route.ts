import { NextRequest, NextResponse } from 'next/server';

// 실험실 API 프록시 — /api/v1/lab/** 를 그대로 백엔드로 넘긴다.
// 권한(실험실 사용 기관 + 관리자)은 백엔드의 LabGuardInterceptor가 판단하므로 여기서는 토큰과 쿼리만 전달한다.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 백엔드가 멈췄을 때 요청이 무한정 걸려 있지 않게 한다.
const UPSTREAM_TIMEOUT_MS = 30_000;

const baseHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...baseHeaders, Allow: 'GET, POST, PUT, DELETE, OPTIONS' } });
}

function message(text: string, status: number) {
  return NextResponse.json({ message: text }, { status, headers: baseHeaders });
}

async function proxy(request: NextRequest, path: string[] | undefined) {
  // '..' 같은 조각이 들어오면 URL 정규화로 /api/v1/lab 밖의 백엔드 경로가 열린다. 조각마다 안전한 문자만 허용한다.
  const segments = path ?? [];
  if (segments.some((s) => s === '' || s === '.' || s === '..' || /[/\\?#]/.test(s))) {
    return message('요청 경로가 올바르지 않습니다', 400);
  }

  const url = new URL(request.url);
  const suffix = segments.length > 0 ? `/${segments.map(encodeURIComponent).join('/')}` : '';
  const target = `${BACKEND_URL}/api/v1/lab${suffix}${url.search}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  let body: string | undefined;
  if (request.method === 'POST' || request.method === 'PUT') {
    headers['Content-Type'] = 'application/json';
    body = await request.text();
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    // 삭제 성공(204)처럼 본문이 없는 응답은 상태 코드만 그대로 돌려준다.
    const text = upstream.status === 204 ? '' : await upstream.text();
    if (text === '') return new NextResponse(null, { status: upstream.status, headers: baseHeaders });

    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status, headers: baseHeaders });
    } catch {
      // 게이트웨이 오류 페이지(HTML) 등 JSON이 아닌 응답은 원문을 노출하지 않고 한국어 메시지로 바꾼다.
      console.error('[Lab API] JSON이 아닌 응답:', upstream.status, text.slice(0, 200));
      return message('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요', upstream.status >= 400 ? upstream.status : 502);
    }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('[Lab API] 프록시 오류:', timedOut ? 'timeout' : error);
    return timedOut ? message('서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요', 504) : message('서버에 연결하지 못했습니다', 502);
  }
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return proxy(request, (await params).path);
}
