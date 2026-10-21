import { NextRequest, NextResponse } from 'next/server';

/**
 * `/api/v1/<base>/**`를 그대로 백엔드로 넘기는 포괄 프록시 — 실험실 프록시(api/v1/lab)와 같은 규칙.
 * 권한은 백엔드가 토큰으로 판단하므로 여기서는 토큰·쿼리·본문만 전달한다.
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

/** 백엔드가 멈췄을 때 요청이 무한정 걸려 있지 않게 한다 */
const UPSTREAM_TIMEOUT_MS = 30_000;

const baseHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

function message(text: string, status: number) {
  return NextResponse.json({ message: text }, { status, headers: baseHeaders });
}

export async function proxyToBackend(request: NextRequest, base: string, path: string[] | undefined, label: string) {
  // '..' 같은 조각이 들어오면 URL 정규화로 base 밖의 백엔드 경로가 열린다. 조각마다 안전한 문자만 허용한다.
  const segments = path ?? [];
  if (segments.some((s) => s === '' || s === '.' || s === '..' || /[/\\?#]/.test(s))) {
    return message('요청 경로가 올바르지 않습니다', 400);
  }

  const url = new URL(request.url);
  const suffix = segments.length > 0 ? `/${segments.map(encodeURIComponent).join('/')}` : '';
  const target = `${BACKEND_URL}${base}${suffix}${url.search}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  let body: string | undefined;
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
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

    // 삭제 성공(204)처럼 본문이 없는 응답은 상태 코드만 그대로 돌려준다
    const text = upstream.status === 204 ? '' : await upstream.text();
    if (text === '') return new NextResponse(null, { status: upstream.status, headers: baseHeaders });

    try {
      return NextResponse.json(JSON.parse(text), { status: upstream.status, headers: baseHeaders });
    } catch {
      // 게이트웨이 오류 페이지(HTML) 등 JSON이 아닌 응답은 원문을 노출하지 않고 한국어 메시지로 바꾼다
      console.error(`[${label}] JSON이 아닌 응답:`, upstream.status, text.slice(0, 200));
      return message('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요', upstream.status >= 400 ? upstream.status : 502);
    }
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error(`[${label}] 프록시 오류:`, timedOut ? 'timeout' : error);
    return timedOut
      ? message('서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요', 504)
      : message('서버에 연결하지 못했습니다', 502);
  }
}

export function proxyOptions(allow: string) {
  return new NextResponse(null, { status: 204, headers: { ...baseHeaders, Allow: allow } });
}
