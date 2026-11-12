'use client';

import type { CSSProperties } from 'react';
import { Center } from '@astryxdesign/core/Center';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { skeletonRowCount, skeletonTitleWidth, SKELETON_META_WIDTH } from '@/lib/skeletonRows';

/**
 * 공용 로딩 표시.
 *
 * 화면마다 `<div style={{display:'flex', justifyContent:'center'...}}>`로 직접 센터링하고
 * 문구·크기가 제각각이던 것을 Astryx `Center` + `Spinner` 조합으로 통일한다.
 *
 * - 위치: `Center`가 지정된 높이 안에서 수직·수평 정렬을 맡는다
 * - 크기: Spinner는 최대 18px(lg)이라, 넓은 영역에서는 높이로 여백을 확보한다
 * - 문구: 항상 라벨을 둔다. 스피너만 있으면 무엇을 기다리는지 알 수 없고,
 *   화면 낭독기 사용자에게도 아무 정보가 없다
 * - 모양(variant): 기본은 스피너. 처음 불러올 때 목록이 나오는 자리에서는 'rows'로
 *   목록 뼈대(제목 막대 + 메타 막대)를 그려 들어올 모양을 미리 보여 준다(DESIGN.md "Motion").
 *   문서 미리보기·파일 올리기·저장 중 덮개·단추 안·더보기 꼬리는 스피너 그대로 둔다.
 */

/** 로딩이 차지할 영역의 크기 단계 */
export type LoadingSize = 'inline' | 'section' | 'page';

const HEIGHT_BY_SIZE: Record<LoadingSize, number | string> = {
  inline: 96,      // 목록 하단 더보기, 카드 안 부분 갱신
  section: 240,    // 탭 본문, 카드 전체
  page: '60vh',    // 페이지 최초 진입
};

const SPINNER_SIZE_BY_SIZE: Record<LoadingSize, 'sm' | 'md' | 'lg'> = {
  inline: 'sm',
  section: 'md',
  page: 'lg',
};

/** 'spinner': 가운데 스피너 + 라벨(기본) / 'rows': 목록 뼈대 */
export type LoadingVariant = 'spinner' | 'rows';

export interface LoadingProps {
  /** 무엇을 불러오는지. 화면과 스크린리더에 함께 쓰인다('rows'에서는 화면에 안 보이고 낭독기만 읽는다). */
  label?: string;
  /** 영역 크기. 기본 section */
  size?: LoadingSize;
  /** 높이 직접 지정이 필요할 때 (size보다 우선) */
  height?: number | string;
  /** 모양. 기본 'spinner' — 기존 호출부는 그대로 스피너다 */
  variant?: LoadingVariant;
}

/** 화면에는 안 보이고 낭독기만 읽는 글자 */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** 뼈대 한 줄 — 높이 48px(--spacing-12, skeletonRows의 SKELETON_ROW_HEIGHT와 같은 값), 목록 행과 같은 좌우 여백 */
const ROW_STYLE: CSSProperties = {
  height: 'var(--spacing-12)',
  padding: '0 var(--spacing-4)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 'var(--spacing-2)',
};

export function Loading({ label = '불러오는 중...', size = 'section', height, variant = 'spinner' }: LoadingProps) {
  const resolvedHeight = height ?? HEIGHT_BY_SIZE[size];

  if (variant === 'rows') {
    const rowCount = skeletonRowCount(resolvedHeight);
    return (
      <div
        role="status"
        className="carev-skel-rows"
        style={{ position: 'relative', width: '100%', height: resolvedHeight, overflow: 'hidden' }}
      >
        <span style={VISUALLY_HIDDEN}>{label}</span>
        {Array.from({ length: rowCount }, (_, i) => (
          <div key={i} aria-hidden="true" style={ROW_STYLE}>
            <Skeleton width={skeletonTitleWidth(i)} height="var(--spacing-3)" radius={0} index={i} />
            <Skeleton width={SKELETON_META_WIDTH} height="var(--spacing-2)" radius={0} index={i} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Center axis="both" width="100%" height={resolvedHeight}>
      <Spinner size={SPINNER_SIZE_BY_SIZE[size]} label={label} />
    </Center>
  );
}

/**
 * 화면 전체를 덮는 로딩. 이미 내용이 그려진 상태에서 갱신을 기다릴 때 쓴다.
 * 처음 진입해서 보여줄 내용이 없을 때는 `<Loading size="page" />`를 쓴다.
 */
export function LoadingOverlay({ label = '처리 중...' }: Pick<LoadingProps, 'label'>) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'color-mix(in srgb, var(--color-background-card) 72%, transparent)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <Center axis="both" width="100%" height="100%">
        <Spinner size="lg" label={label} />
      </Center>
    </div>
  );
}

export default Loading;
