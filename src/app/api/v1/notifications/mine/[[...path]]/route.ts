import { NextRequest } from 'next/server';
import { proxyOptions, proxyToBackend } from '@/lib/backendProxy';

// 내 알림함 프록시 — 받는 사람은 백엔드가 토큰으로 정한다(남의 알림은 읽거나 확인할 수 없다).
const BASE = '/api/v1/notifications/mine';

type Ctx = { params: Promise<{ path?: string[] }> };

export async function OPTIONS() {
  return proxyOptions('GET, POST, OPTIONS');
}

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'My Notifications API');
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'My Notifications API');
}
