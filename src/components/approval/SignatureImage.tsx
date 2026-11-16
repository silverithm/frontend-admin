'use client';

import { useState, type CSSProperties } from 'react';

/**
 * 결재·회의록 서명 그림 — 못 불러오면 깨진 그림 대신 '이름 (인)'을 쓴다(2026-11-16).
 *
 * 서버가 '내 서명'을 바꿀 때 옛 서명 파일을 지우던 탓에(api-server 793ab93에서 멈춤) 숲속 원장(김도형)의
 * 지난 결재 372건·회의록 서명 몇 건이 가리키는 파일이 S3에서 사라졌다. 버킷 버전 보관이 꺼져 있어 되살릴 수 없다.
 * 서명이 있던 칸이 깨진 그림 아이콘으로 남으면 문서가 망가져 보이므로, 서명 없이 승인했을 때와 같은 글자로 둔다.
 */
export default function SignatureImage({
  src,
  name,
  fallback,
  className,
  style,
}: {
  src: string;
  name: string;
  /** 못 불러왔을 때 쓸 글자 — 기본 '이름 (인)' */
  fallback?: string;
  className?: string;
  style?: CSSProperties;
}) {
  // 주소가 바뀌면(다른 문서) 다시 시도한다 — 실패한 주소만 기억한다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) {
    return <span>{fallback ?? `${name} (인)`}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${name} 서명`} className={className} style={style} onError={() => setFailedSrc(src)} />
  );
}
