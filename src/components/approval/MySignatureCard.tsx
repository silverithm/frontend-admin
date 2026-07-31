'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { FileInput } from '@astryxdesign/core/FileInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { getMySignature, registerMySignature, deleteMySignature } from '@/lib/apiService';
import SignatureCanvas, { SignatureCanvasHandle } from './SignatureCanvas';

type SignatureMode = 'draw' | 'upload';

interface MySignatureCardProps {
  onNotification?: (message: string, type: 'success' | 'error' | 'info') => void;
}

/** 이미지 파일을 PNG data URL로 변환 (JPG 등도 캔버스로 재인코딩해 PNG 통일) */
function fileToPngDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('이미지 처리에 실패했습니다.'));
        return;
      }
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };
    image.src = url;
  });
}

/**
 * 내 결재 서명 등록 카드. 캔버스 그리기 또는 이미지 업로드로 등록한다.
 * 등록된 서명은 결재 승인 시 결재란에 자동 날인된다.
 */
export default function MySignatureCard({ onNotification }: MySignatureCardProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);

  const notify = (message: string, type: 'success' | 'error' | 'info') => {
    onNotification?.(message, type);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getMySignature();
        if (!cancelled) setSignatureUrl(response?.signatureUrl ?? null);
      } catch (error) {
        console.error('서명 조회 실패:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let dataUrl: string | null = null;

      if (mode === 'draw') {
        dataUrl = canvasRef.current?.toDataURL() ?? null;
        if (!dataUrl) {
          notify('서명을 먼저 그려주세요.', 'error');
          return;
        }
      } else {
        if (!uploadFile) {
          notify('서명 이미지를 선택해주세요.', 'error');
          return;
        }
        dataUrl = await fileToPngDataUrl(uploadFile);
      }

      const response = await registerMySignature(dataUrl);
      setSignatureUrl(response?.signatureUrl ?? null);
      canvasRef.current?.clear();
      setUploadFile(null);
      notify('서명이 등록되었습니다. 결재 승인 시 자동으로 날인됩니다.', 'success');
    } catch (error) {
      console.error('서명 등록 실패:', error);
      notify(error instanceof Error ? error.message : '서명 등록에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await deleteMySignature();
      setSignatureUrl(null);
      notify('서명이 삭제되었습니다.', 'success');
    } catch (error) {
      console.error('서명 삭제 실패:', error);
      notify('서명 삭제에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <HStack hAlign="center" style={{ padding: 'var(--spacing-4)' }}>
        <Spinner size="sm" />
      </HStack>
    );
  }

  return (
    <VStack gap={3}>
      {/* 등록된 서명 미리보기 */}
      {signatureUrl ? (
        <VStack gap={2}>
          <Text type="supporting" color="secondary">등록된 서명</Text>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 200,
              height: 100,
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-inner)',
              background: '#ffffff',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signatureUrl}
              alt="내 결재 서명"
              style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
            />
          </div>
          <HStack gap={2}>
            <Button label="삭제" variant="destructive" size="sm" isDisabled={isSaving} onClick={handleDelete} />
          </HStack>
          <Text type="supporting" color="secondary">아래에서 새로 등록하면 기존 서명을 대체합니다.</Text>
        </VStack>
      ) : (
        <Banner
          status="info"
          title="등록된 서명이 없습니다."
          description="서명을 등록하면 결재 승인 시 자동으로 날인됩니다."
        />
      )}

      {/* 등록 방식 */}
      <SegmentedControl
        value={mode}
        onChange={(value) => setMode(value as SignatureMode)}
        label="서명 등록 방식"
      >
        <SegmentedControlItem value="draw" label="직접 그리기" />
        <SegmentedControlItem value="upload" label="이미지 업로드" />
      </SegmentedControl>

      {mode === 'draw' ? (
        <SignatureCanvas ref={canvasRef} onChange={(isEmpty) => setCanvasEmpty(isEmpty)} />
      ) : (
        <FileInput
          label="서명 이미지 (PNG/JPG)"
          accept="image/png,image/jpeg"
          value={uploadFile}
          onChange={(files) => {
            const file = Array.isArray(files) ? files[0] ?? null : files;
            setUploadFile(file);
          }}
        />
      )}

      <HStack hAlign="end">
        <Button
          label={isSaving ? '등록 중...' : '서명 등록'}
          variant="primary"
          isLoading={isSaving}
          isDisabled={isSaving || (mode === 'draw' ? canvasEmpty : !uploadFile)}
          onClick={handleSave}
        />
      </HStack>
    </VStack>
  );
}
