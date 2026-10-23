import { NextRequest } from 'next/server';
import { proxyOptions, proxyToBackend } from '@/lib/backendProxy';

// 비밀번호 재설정 링크 확인·확정 프록시 — 로그인 전에 쓰므로 토큰 없이 그대로 넘긴다.
const BASE = '/api/v1/password-reset';

type Ctx = { params: Promise<{ path?: string[] }> };

export async function OPTIONS() {
  return proxyOptions('GET, POST, OPTIONS');
}

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'PasswordReset API');
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'PasswordReset API');
}
