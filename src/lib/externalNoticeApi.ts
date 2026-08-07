// 장기요양 소식(노인장기요양보험 longtermcare.or.kr 게시판 4종 자동 수집) API 클라이언트.
// 백엔드가 주기적으로 자동 수집한 외부 공지 목록을 페이지 형태로 내려준다.

/** 백엔드가 내려주는 출처 코드. 구버전 백엔드는 sourceLabel을 내려주지 않을 수 있다. */
export type ExternalNoticeSource = 'LTC_NOTICE' | 'LTC_LAW' | 'LTC_EVAL' | 'LTC_EDU' | string;

/** source 코드 → 라벨 폴백 매핑. 응답에 sourceLabel이 없을 때(구버전 백엔드) 사용한다. */
export const EXTERNAL_NOTICE_SOURCE_LABEL_FALLBACK: Record<string, string> = {
  LTC_NOTICE: '공지사항',
  LTC_LAW: '법령자료실',
  LTC_EVAL: '평가 매뉴얼',
  LTC_EDU: '기관종사자 교육',
  // 구버전 호환
  NHIS_LTC_NOTICE: '공지사항',
};

export interface ExternalNotice {
  id: number;
  /** 공지 출처 코드. 예: "LTC_NOTICE" (노인장기요양보험 공지사항) */
  source: ExternalNoticeSource;
  /** 출처 표시용 라벨. 구버전 백엔드는 내려주지 않을 수 있으므로 없으면 코드로 폴백 매핑한다. */
  sourceLabel?: string;
  title: string;
  /** longtermcare.or.kr 등 외부 상세 페이지 링크 */
  url: string;
  postedDate: string;
}

export interface ExternalNoticePage {
  content: ExternalNotice[];
  totalPages: number;
  totalElements: number;
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 응답에 sourceLabel이 없는 항목에 폴백 라벨을 채워 넣는다. */
function withSourceLabelFallback(content: ExternalNotice[]): ExternalNotice[] {
  return content.map((n) => ({
    ...n,
    sourceLabel: n.sourceLabel || EXTERNAL_NOTICE_SOURCE_LABEL_FALLBACK[n.source] || n.source,
  }));
}

/**
 * 장기요양 소식 목록을 페이지 단위로 조회한다.
 * 응답은 Spring Page 래퍼({ content, totalPages, totalElements, ... })이므로
 * 절대 응답 전체를 배열처럼 다루지 않고 content만 추출한다.
 * @param source 특정 게시판만 조회하고 싶을 때 전달 (LTC_NOTICE/LTC_LAW/LTC_EVAL/LTC_EDU). 생략 시 전체.
 */
export async function fetchExternalNotices(
  page = 0,
  size = 20,
  source?: ExternalNoticeSource
): Promise<ExternalNoticePage> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (source) params.set('source', source);

  const response = await fetch(`/api/v1/external-notices?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || `장기요양 소식을 불러오지 못했습니다. (${response.status})`);
  }

  const content = Array.isArray(data) ? data : (data.content || []);
  return {
    content: withSourceLabelFallback(content),
    totalPages: typeof data.totalPages === 'number' ? data.totalPages : 0,
    totalElements: typeof data.totalElements === 'number' ? data.totalElements : content.length,
  };
}
