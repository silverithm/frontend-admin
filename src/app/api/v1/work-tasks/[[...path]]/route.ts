import { NextRequest } from 'next/server';
import { proxyOptions, proxyToBackend } from '@/lib/backendProxy';

// 업무진행도 API 프록시 — /api/v1/work-tasks/** 를 그대로 백엔드로 넘긴다.
// 기관·권한(관리자·등록한 사람·담당자)은 백엔드가 토큰으로 판단한다.
const BASE = '/api/v1/work-tasks';

type Ctx = { params: Promise<{ path?: string[] }> };

export async function OPTIONS() {
  return proxyOptions('GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'WorkTask API');
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'WorkTask API');
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'WorkTask API');
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'WorkTask API');
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return proxyToBackend(request, BASE, (await params).path, 'WorkTask API');
}
