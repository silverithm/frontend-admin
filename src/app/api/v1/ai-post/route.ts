import { NextRequest, NextResponse } from 'next/server';

// AI 글쓰기 도우미 — 사진(식사/프로그램)을 보고 밴드·블로그 게시글을 자동 작성한다.
// Gemini 키는 서버 전용(GEMINI_API_KEY). 클라이언트에는 절대 노출하지 않는다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://silverithm.site';

// Vercel 등 서버리스 환경에서 이미지 여러 장 처리 시간 확보
export const maxDuration = 60;

const headers = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

interface AiPostImage {
  mimeType: string;
  data: string; // base64 (클라이언트에서 1024px로 축소해서 보낸다)
}

interface AiPostRequest {
  channel: 'band' | 'blog';
  description?: string;
  companyName?: string;
  date?: string;
  images: AiPostImage[];
}

const MAX_IMAGES = 5;
// 클라이언트가 축소해서 보내지만, 우회 호출 대비 장당 base64 2MB로 제한
const MAX_IMAGE_BASE64_LENGTH = 2 * 1024 * 1024;

const CHANNEL_GUIDE: Record<'band' | 'blog', string> = {
  band: `[글 형식: 네이버 밴드 게시글]
- 보호자(어르신 가족)들이 읽는 글이다. 친근하고 따뜻한 존댓말을 쓴다.
- 문단마다 이모지를 1~2개 자연스럽게 섞는다.
- 짧은 문단 2~4개, 전체 300~500자.
- 제목은 밴드 글 첫 줄로 쓸 수 있게 짧고 정감 있게.`,
  blog: `[글 형식: 블로그 게시글]
- 검색으로 유입되는 글이다. 제목에 활동 내용이 드러나게 쓰고, 기관명이 주어졌다면 제목이나 본문에 자연스럽게 넣는다.
- 자연스러운 문단 4~6개, 전체 600~900자. 이모지는 아주 절제해서 사용한다.
- 마지막 문단에 기관을 소개하고 방문·상담을 부드럽게 안내하는 한두 문장을 넣는다.`,
};

// 토큰이 우리 서비스의 유효한 로그인인지 백엔드에 물어본다.
//
// 계정이 두 테이블로 나뉘어 있어서 확인 경로도 둘이다.
// - /users/info 는 AppUser(기관 관리자)만 해석한다. JWT subject를 AppUser.email로 조회하는데,
//   직원 토큰의 subject는 Member.username이라 여기서 404가 난다.
// - /users/company-homepage 는 CallerCompanyResolver로 Member·AppUser 양쪽을 해석한다
//   ("직원도 볼 수 있어야 한다"고 백엔드에 명시돼 있다).
//
// 그래서 관리자용을 먼저 보고, 실패하면 직원도 통과하는 쪽으로 한 번 더 확인한다.
// 두 경로 모두 인증이 필요한(permitAll이 아닌) 엔드포인트라, 서명이 깨졌거나 만료된
// 토큰은 백엔드 시큐리티 필터가 401로 먼저 끊는다 — 느슨해지지 않는다.
const VERIFY_PATHS = ['/api/v1/users/info', '/api/v1/users/company-homepage'];

async function isAuthenticatedCaller(authHeader: string): Promise<boolean> {
  for (const path of VERIFY_PATHS) {
    try {
      const response = await fetch(`${BACKEND_URL}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: authHeader },
      });
      if (response.ok) return true;
      // 401/403이면 토큰 자체가 무효다 — 다음 경로를 봐도 통과할 리 없으니 즉시 끝낸다.
      if (response.status === 401 || response.status === 403) return false;
      // 404 등은 "이 경로가 이 계정 종류를 해석하지 못한다"는 뜻이라 다음 경로로 넘어간다.
    } catch (error) {
      console.error(`[AI 글쓰기] 토큰 검증 요청 실패 (${path}):`, error);
    }
  }
  return false;
}

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
    if (!(await isAuthenticatedCaller(authHeader))) {
      return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401, headers });
    }

    const body = (await request.json()) as AiPostRequest;
    const { channel, description, companyName, date, images } = body;

    if (channel !== 'band' && channel !== 'blog') {
      return NextResponse.json({ error: '채널은 band 또는 blog여야 합니다.' }, { status: 400, headers });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '사진을 1장 이상 올려주세요.' }, { status: 400, headers });
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json({ error: `사진은 최대 ${MAX_IMAGES}장까지 가능합니다.` }, { status: 400, headers });
    }
    for (const image of images) {
      if (!image?.mimeType?.startsWith('image/') || typeof image.data !== 'string') {
        return NextResponse.json({ error: '이미지 형식이 올바르지 않습니다.' }, { status: 400, headers });
      }
      if (image.data.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: '이미지가 너무 큽니다. 다시 시도해주세요.' }, { status: 400, headers });
      }
    }

    const prompt = `당신은 주간보호센터(어르신 데이케어센터)의 홍보 글을 전담하는 작가입니다.
첨부된 사진들을 보고 오늘의 활동(식사, 인지 프로그램, 만들기, 나들이 등)을 파악해서 게시글 한 편을 작성하세요.

[기관명] ${companyName || '(기관명 미제공 — 글에서 기관명 언급은 생략)'}
[날짜] ${date || '(날짜 미제공 — 날짜 언급은 생략)'}
[선생님이 남긴 설명] ${description?.trim() || '(설명 없음 — 사진만 보고 판단)'}

${CHANNEL_GUIDE[channel]}

[공통 규칙]
- 사진에 실제로 보이는 것(음식 메뉴, 활동 종류, 만든 작품, 분위기)을 구체적으로 언급한다. 보이지 않는 것을 지어내지 않는다.
- 어르신 개인을 특정하는 표현(이름, 병명, 신체 상태 묘사)은 절대 쓰지 않는다. "어르신들"처럼 표현한다.
- 과장 광고 표현("최고", "1등")은 피하고 따뜻하고 담백하게 쓴다.
- 해시태그는 5~10개, 각 항목에 #을 붙여서 만든다. 활동 내용과 기관 성격(주간보호, 어르신, 실버케어 등)을 섞는다.
- 반드시 한국어로 작성한다.`;

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            ...images.map((image) => ({
              inline_data: { mime_type: image.mimeType, data: image.data },
            })),
          ],
        },
      ],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: '게시글 제목' },
            content: { type: 'STRING', description: '게시글 본문 (문단은 빈 줄로 구분)' },
            hashtags: { type: 'ARRAY', items: { type: 'STRING' }, description: '#포함 해시태그 목록' },
          },
          required: ['title', 'content', 'hashtags'],
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
        { error: 'AI 글 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502, headers },
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText: string | undefined = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error('Gemini 응답에 텍스트가 없음:', JSON.stringify(geminiData).slice(0, 500));
      return NextResponse.json(
        { error: 'AI가 글을 생성하지 못했습니다. 사진을 바꾸거나 다시 시도해주세요.' },
        { status: 502, headers },
      );
    }

    let parsed: { title?: string; content?: string; hashtags?: string[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // JSON 모드가 어긋난 드문 경우 — 본문만이라도 돌려준다
      parsed = { title: '', content: rawText, hashtags: [] };
    }

    return NextResponse.json(
      {
        title: parsed.title || '',
        content: parsed.content || '',
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      },
      { headers },
    );
  } catch (error) {
    console.error('AI 글쓰기 처리 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers });
  }
}
