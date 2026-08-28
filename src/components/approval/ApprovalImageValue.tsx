'use client';

import { useEffect, useState } from 'react';
import { Text } from '@astryxdesign/core/Text';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack } from '@astryxdesign/core/Stack';

interface ApprovalImageValueProps {
  /** 업로드 응답의 filePath(S3 상대경로) — 이미 절대 URL이면 그대로 쓴다 */
  fileUrl?: string | null;
  fileName?: string | null;
  alt?: string;
  maxWidth?: number | string;
  maxHeight?: number | string;
}

/**
 * formData의 이미지 필드 값을 문서 본문에 그린다.
 *
 * 업로드 직후 저장되는 fileUrl은 S3 상대경로라서 <img src>에 바로 못 쓴다
 * (다운로드 API 자체가 인증을 요구해서 서명 없는 <img> 태그로는 못 받는다).
 * 그래서 인증 fetch로 이미지를 받아 blob URL로 바꿔 그린다.
 *
 * 서명·직인 이미지(OfficialDocument의 signatureUrl/companySealUrl)는 공개 버킷의 절대 URL을
 * 서버가 만들어줘서 <img src>에 바로 쓰고, 그 대신 인쇄 캡처 때 CORS를 inlineCrossOriginImages가
 * 우회한다. 이 필드는 formData(불투명 JSON)라 서버가 절대 URL로 바꿔줄 수 없어 경로가 다르지만,
 * blob URL은 애초에 같은 출처로 취급되어 인쇄 캡처 시 CORS 문제 자체가 생기지 않는다 —
 * inlineCrossOriginImages는 http(s) src만 골라 처리하므로 blob: URL은 그냥 지나치고,
 * 이미 로드된 이미지 그대로 캡처된다.
 */
export default function ApprovalImageValue({
  fileUrl,
  fileName,
  alt,
  maxWidth = 320,
  maxHeight = 360,
}: ApprovalImageValueProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    setSrc(null);
    if (!fileUrl) return;

    // 이미 절대 URL이거나 로컬 미리보기(blob:/data:)면 그대로 쓴다
    if (/^(https?:|blob:|data:)/.test(fileUrl)) {
      setSrc(fileUrl);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        const response = await fetch(`/api/v1/files/download?path=${encodeURIComponent(fileUrl)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error('이미지를 불러오지 못했습니다');
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileUrl]);

  if (!fileUrl) {
    return <Text color="disabled">-</Text>;
  }

  if (error) {
    return <Text type="supporting" color="secondary">이미지를 불러오지 못했습니다</Text>;
  }

  if (!src) {
    return (
      <HStack gap={2} vAlign="center">
        <Spinner size="sm" />
        <Text type="supporting" color="secondary">이미지 불러오는 중...</Text>
      </HStack>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt || fileName || '첨부 이미지'}
      className="carev-doc-image-value"
      style={{
        display: 'block',
        maxWidth,
        maxHeight,
        width: 'auto',
        height: 'auto',
        borderRadius: 'var(--radius-inner)',
        border: '1px solid var(--color-border)',
      }}
    />
  );
}
