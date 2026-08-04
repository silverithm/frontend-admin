// 요양 소식 중복 묶기.
//
// 뉴스는 Google News RSS로 모으는데, 지자체 보도자료 하나를 여러 매체가 그대로
// 받아쓰는 일이 잦다. 실제로 '평택시 AI 요양원' 건은 표현만 조금씩 다른 기사가
// 15건 넘게 목록을 채웠다. 같은 사안은 하나로 묶고 나머지는 '+N개 매체'로 접는다.
//
// 판정은 제목의 문자 bigram 유사도(Dice)로 한다. 한국어는 조사·어미가 붙어
// 단어 단위 비교가 잘 맞지 않는데, bigram은 'AI로 요양원 낙상' / 'AI 기반 노인요양원'
// 처럼 표현이 달라도 겹치는 부분을 잡아낸다.

import type { NewsItem } from './newsMock';

/** 유사하다고 볼 최소 Dice 계수. 낮추면 과하게 묶이고, 높이면 중복이 남는다. */
const SIMILARITY_THRESHOLD = 0.34;

/** 제목 앞머리의 매체 표기나 말머리를 떼어낸다 — [단독], (종합), [3일 평택시] 등 */
function stripPrefix(title: string): string {
  return title.replace(/^\s*[\[\(【][^\]\)】]{0,20}[\]\)】]\s*/g, '');
}

/**
 * 비교용으로 제목을 정규화한다.
 * - 매체 말머리 제거
 * - 동의어 통일 (AI/인공지능 처럼 같은 말을 다르게 쓴 경우)
 * - 공백·문장부호 제거
 */
function normalize(title: string): string {
  return stripPrefix(title)
    .toLowerCase()
    .replace(/인공지능/g, 'ai')
    .replace(/노인요양원|요양시설|노인요양시설/g, '요양원')
    .replace(/어르신|고령자/g, '노인')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < text.length - 1; i += 1) {
    set.add(text.slice(i, i + 2));
  }
  return set;
}

/** Dice 계수 — 겹치는 bigram 비율 (0~1) */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) {
    if (b.has(gram)) shared += 1;
  }
  return (2 * shared) / (a.size + b.size);
}

export interface NewsCluster {
  /** 대표 기사 — 묶인 것 중 가장 최신 */
  lead: NewsItem;
  /** 같은 사안을 다룬 다른 매체 기사 (대표 제외) */
  duplicates: NewsItem[];
}

/**
 * 같은 사안을 다룬 기사끼리 묶는다. 입력 순서(최신순)를 유지한다.
 *
 * 클러스터 안의 어느 기사와든 비슷하면 합류시킨다(single-linkage). 대표 하나와만
 * 비교하면 'AI로 낙상 감지' / 'AI 기반 돌봄 구축'처럼 같은 보도자료인데 표현이
 * 갈린 기사들이 서로 다른 묶음으로 흩어진다.
 *
 * 카테고리는 묶는 조건에서 뺐다. 같은 사안이 매체에 따라 '학대·안전'과 '현장소식'으로
 * 다르게 분류되는 경우가 있어, 조건에 넣으면 중복이 그대로 남는다.
 */
export function clusterNews(items: NewsItem[]): NewsCluster[] {
  const clusters: { lead: NewsItem; duplicates: NewsItem[]; grams: Set<string>[] }[] = [];

  for (const item of items) {
    const grams = bigrams(normalize(item.title));
    const match = clusters.find((c) =>
      c.grams.some((g) => similarity(g, grams) >= SIMILARITY_THRESHOLD),
    );

    if (match) {
      match.duplicates.push(item);
      match.grams.push(grams);
    } else {
      clusters.push({ lead: item, duplicates: [], grams: [grams] });
    }
  }

  return clusters.map(({ lead, duplicates }) => ({ lead, duplicates }));
}

/** 중복을 접은 대표 기사만 반환 (홈 위젯처럼 목록만 필요할 때) */
export function dedupeNews(items: NewsItem[]): NewsItem[] {
  return clusterNews(items).map((c) => c.lead);
}
