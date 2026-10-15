import { NextRequest, NextResponse } from 'next/server';
import { isLabAiTask, labAiBodyLimit, prepareLabAiTask } from '@/lib/lab/labPrompts';

// 실험실 AI 작업 27종(급여제공기록 정리 · 위험도 점수 제안 · 평가 증빙 검토 · 간호일지 바이탈 요약 · 프로그램 일지 · 교육·회의 기록 · 상담일지 · 급여제공계획 초안 · 주간 식단 · 점검 부적합 조치 계획 · 장부 계정 제안 · 사고 기록 정리 · 기능회복훈련 정리 · 보호자 안내 초안 · 자원연계 종류 제안 · 예산 초안 · 투약의뢰서 약 목록 정리 · 퇴소 연계기록지 초안 · 목욕 메모 정리 · 7차: 월간 프로그램 계획표 · 사업계획 초안 · 만족도 의견 주제 요약 · 입소 상담 메모 정리 · 8차: 진료 동행 메모 정리 · 운영위원회 회의록 정리 · 10차: 사례관리 회의 메모 정리 · 규정 원문 항목 점검).
// 흐름: 작업 이름 확인 → 로그인 확인 → 백엔드에 "이 기관이 실험실을 쓸 수 있는가" 확인 → 입력 검증 → 모델 호출 → 응답 정규화.
// 모델 키는 서버 전용(GEMINI_API_KEY)이다. 모델로 가는 글은 직원이 적은 메모·관찰·증빙 설명(바이탈 요약은 날짜와 숫자, 식단은 메뉴 이름·점검은 항목 문장, 장부는 내역 문구와 금액, 5차는 사고·훈련 메모와 날짜·수치로 모은 사실 묶음, 예산 초안은 계정 이름과 전년 실적 금액, 6차는 보호자 메모·약봉투 글과 기간 사실 묶음·목욕 메모, 7차는 운영일 날짜·연간계획 목표·숫자 요약·이름을 지운 의견과 상담 메모, 8차는 이름을 지운 진료 메모와 위원 이름을 '[위원]'으로 바꾼 회의 메모, 10차는 이름을 지운 사례회의 메모와 직종 이름·저장하지 않는 규정 원문)뿐이고 어르신·직원·보호자 이름은 보내지 않는다.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 모델이 느릴 때 서버리스 제한(60초)보다 먼저 끊어서 사용자에게 한국어 오류를 돌려준다.
export const maxDuration = 60;
const MODEL_TIMEOUT_MS = 45_000;
const ACCESS_TIMEOUT_MS = 8_000;
// 정상 입력은 메모 3,000자 + 요건 몇 줄이라 수십 KB를 넘지 않는다. 우회 호출로 큰 본문을 보내는 것을 막는다.
const MAX_BODY_CHARS = 40_000;
// 한글은 글자당 3바이트라 글자 수 한도의 3배(+여유)를 바이트 상한으로 두고, 본문을 읽기 전에 헤더로 먼저 거른다.
const MAX_BODY_BYTES = 150_000;

const headers = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

function reply(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers });
}

class ModelError extends Error {}

// ---------- 모델 호출 (나중에 Claude 등으로 바꿀 때 이 함수만 교체한다) ----------

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** 프롬프트와 JSON 스키마를 주고 모델이 만든 JSON을 받는다. 실패하면 ModelError. */
async function callModel(prompt: string, schema: object): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ModelError('GEMINI_API_KEY 미설정');

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      // 키를 URL에 넣으면 접속 로그에 남을 수 있어 헤더로 보낸다.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // 기록 정리·점수 제안은 창작이 아니라 추출이므로 온도를 낮춘다.
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema },
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ModelError(error instanceof Error && error.name === 'TimeoutError' ? '모델 응답 시간 초과' : '모델 연결 실패');
  }

  if (!response.ok) {
    // 응답 본문에는 입력 일부가 반사될 수 있어 상태 코드만 남긴다.
    throw new ModelError(`모델 오류 ${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  } | null;
  // 추론(thought) 조각을 빼고 답 조각만 이어 붙인다.
  const text = data?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('') ?? '';
  if (!text) throw new ModelError('모델이 빈 응답을 반환');
  try {
    return JSON.parse(text);
  } catch {
    throw new ModelError('모델 응답이 JSON이 아님');
  }
}

// ---------- 실험실 권한 ----------

type AccessResult = 'enabled' | 'disabled' | 'unauthorized' | 'unavailable';

async function checkLabAccess(authHeader: string): Promise<AccessResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/lab/access`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(ACCESS_TIMEOUT_MS),
    });
    if (response.status === 401) return 'unauthorized';
    // 계약상 /access는 로그인한 사람에게 403을 주지 않는다. 403이 오면 토큰을 인정받지 못한 것이니 "열려 있지 않음"으로 닫는다.
    if (response.status === 403) return 'disabled';
    if (!response.ok) return 'unavailable';
    const data = (await response.json().catch(() => null)) as { enabled?: unknown } | null;
    // 정확히 true일 때만 연다 — 필드가 없거나 문자열 "true"여도 닫힌 것으로 본다.
    return data?.enabled === true ? 'enabled' : 'disabled';
  } catch (error) {
    console.error('[Lab AI] 실험실 권한 확인 실패:', error instanceof Error ? error.name : 'error');
    return 'unavailable';
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  if (!isLabAiTask(task)) return reply('지원하지 않는 AI 작업입니다', 400);

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return reply('로그인이 필요합니다', 401);

  const access = await checkLabAccess(authHeader);
  if (access === 'unauthorized') return reply('로그인이 만료되었습니다. 다시 로그인해 주세요', 401);
  if (access === 'unavailable') return reply('실험실 사용 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요', 502);
  if (access !== 'enabled') return reply('실험실은 아직 이 기관에 열려 있지 않습니다', 403);

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return reply('입력이 너무 깁니다', 400);
  const text = await request.text().catch(() => '');
  if (text.length > MAX_BODY_CHARS) return reply('입력이 너무 깁니다', 400);
  // 5~8차 작업은 글 입력 3,000자(예산 초안·만족도 의견 요약은 목록 때문에 20,000자, 계획표·사업계획은 8,000자)로 더 좁게 막는다.
  const taskLimit = labAiBodyLimit(task);
  if (taskLimit !== null && text.length > taskLimit) return reply('입력이 너무 깁니다', 400);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply('요청 형식이 올바르지 않습니다', 400);
  }

  const prepared = prepareLabAiTask(task, body);
  if (!prepared.ok) return reply(prepared.message, 400);

  try {
    const raw = await callModel(prepared.prompt, prepared.schema);
    return NextResponse.json(prepared.normalize(raw), { headers });
  } catch (error) {
    // 입력(메모)이 로그에 남지 않도록 오류 종류만 기록한다.
    console.error(`[Lab AI] ${task} 실패:`, error instanceof ModelError ? error.message : '응답 정규화 실패');
    return reply('AI가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요', 502);
  }
}
