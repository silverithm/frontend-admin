import { NextRequest, NextResponse } from 'next/server';

// 회의록 AI 자동 정리 — 회의 중 흘려 쓴 메모와 녹음 전사문을 섹션별 개조식 회의록로 정리한다.
// Gemini 키는 서버 전용(GEMINI_API_KEY). 클라이언트에는 절대 노출하지 않는다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// 긴 회의 전사문 처리 시간 확보
export const maxDuration = 60;

const headers = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

interface SectionSpec {
  key: string;
  label: string;
}

interface MinutesAiRequest {
  sections: SectionSpec[];
  rawNotes?: string;
  transcript?: string;
  title?: string;
}

// 전사문이 아주 길어도 요청이 터지지 않게 자른다 (2시간 회의 ≈ 3~4만 자)
const MAX_SOURCE_LENGTH = 120_000;

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY가 서버에 설정되지 않았습니다.' },
        { status: 500, headers },
      );
    }

    // 로그인한 사용자만 사용 가능 — 토큰을 백엔드에 실제 검증해서 키 무단 사용을 막는다
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers });
    }
    const verifyResponse = await fetch(`${BACKEND_URL}/api/v1/users/info`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authHeader },
    });
    if (!verifyResponse.ok) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401, headers });
    }

    const body = (await request.json()) as MinutesAiRequest;
    const sections = Array.isArray(body.sections) ? body.sections.filter((s) => s?.key && s?.label) : [];
    if (sections.length === 0) {
      return NextResponse.json({ error: '섹션 구성이 필요합니다.' }, { status: 400, headers });
    }

    const rawNotes = (body.rawNotes || '').slice(0, MAX_SOURCE_LENGTH);
    const transcript = (body.transcript || '').slice(0, MAX_SOURCE_LENGTH);
    if (!rawNotes.trim() && !transcript.trim()) {
      return NextResponse.json({ error: '정리할 메모나 녹음 전사문이 없습니다.' }, { status: 400, headers });
    }

    const sectionList = sections.map((s) => `- ${s.label} (key: ${s.key})`).join('\n');

    const prompt = `당신은 주간보호센터(어르신 데이케어센터)의 회의록 서기입니다.
회의 중 실시간으로 받아 적은 메모와 녹음 전사문을 읽고, 아래 섹션 구성에 맞춰 회의록을 정리하세요.

[회의 주제] ${body.title?.trim() || '(제공되지 않음)'}

[섹션 구성]
${sectionList}

[정리 규칙]
- 각 항목은 "* "로 시작하는 개조식 한 줄로 쓴다. 문장 끝은 "~예정.", "~하기.", "~숙지하기."처럼 간결한 개조식으로 맺는다.
- 내용상 맞는 섹션에 배치한다. 해당 섹션에 넣을 내용이 없으면 그 섹션의 content는 빈 문자열로 둔다.
- 전사문의 잡담·인사말·반복은 걸러내고 업무 결정사항·전달사항·특이사항만 남긴다.
- 어르신 성함이 언급되면 "홍길동어르신"처럼 이름 뒤에 '어르신'을 붙여 쓴다.
- 메모와 전사문에 실제로 있는 내용만 쓴다. 없는 내용을 지어내지 않는다.
- 반드시 한국어로 작성한다.

[예시 출력 형태]
* 내일 가랜드 만들기 수업 마무리 예정.
* 금일부터 9월 근무표 작성 예정이며 다음 달부터는 휴무 확정 후 연차를 추가하는 방식으로 진행 예정.

[회의 중 받아 적은 메모]
${rawNotes.trim() || '(없음)'}

[녹음 전사문]
${transcript.trim() || '(없음)'}`;

    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // 창작이 아니라 충실한 정리가 목적 — 낮은 온도
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            sections: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  key: { type: 'STRING', description: '섹션 key (주어진 구성 그대로)' },
                  content: { type: 'STRING', description: '"* " 개조식 항목들. 내용 없으면 빈 문자열' },
                },
                required: ['key', 'content'],
              },
            },
          },
          required: ['sections'],
        },
      },
    };

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API 오류:', geminiResponse.status, errorText.slice(0, 500));
      return NextResponse.json(
        { error: 'AI 정리에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502, headers },
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText: string | undefined = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error('Gemini 응답에 텍스트가 없음:', JSON.stringify(geminiData).slice(0, 500));
      return NextResponse.json(
        { error: 'AI가 회의록을 정리하지 못했습니다. 다시 시도해주세요.' },
        { status: 502, headers },
      );
    }

    let parsed: { sections?: { key?: string; content?: string }[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'AI 응답을 해석하지 못했습니다. 다시 시도해주세요.' },
        { status: 502, headers },
      );
    }

    // 요청한 섹션 구성 순서대로 정렬해 돌려준다 — 못 받은 섹션은 빈 내용
    const byKey = new Map<string, string>();
    for (const section of parsed.sections || []) {
      if (section?.key) byKey.set(section.key, section.content || '');
    }
    const result = sections.map((s) => ({ key: s.key, label: s.label, content: byKey.get(s.key) || '' }));

    return NextResponse.json({ sections: result }, { headers });
  } catch (error) {
    console.error('회의록 AI 정리 처리 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
