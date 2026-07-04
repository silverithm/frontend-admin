'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiDownload, FiFileText, FiAlertCircle, FiCheck, FiCloud } from 'react-icons/fi';
import { Dialog } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import type { RhwpEditor } from '@rhwp/editor';

// 셀프 호스팅된 rhwp-studio (public/rhwp-studio/) — Ctrl+S 가로채기/isDirty 패치 포함
const STUDIO_URL = '/rhwp-studio/index.html';
// 자동 저장 주기 (ms)
const AUTOSAVE_INTERVAL = 30_000;

interface DocumentViewerModalProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  /** 지정하면 HWP/HWPX 편집 모드: 작성 완료/Ctrl+S/자동 저장으로 파일을 돌려받는다 */
  onSave?: (file: File) => void;
  /** 중간 저장(Ctrl+S, 자동 저장) 시 조용히 파일만 갱신 — 모달 전환 없음 */
  onAutoSave?: (file: File) => void;
  saveLabel?: string;
}

type ViewerState =
  | { kind: 'loading'; message?: string }
  | { kind: 'pdf'; objectUrl: string }
  | { kind: 'image'; objectUrl: string; note?: string }
  | { kind: 'hwp' }
  | { kind: 'unsupported'; message: string }
  | { kind: 'error'; message: string };

// S3 URL에서 상대 경로 추출 (carev/ 이후 부분)
const extractRelativePath = (url: string): string => {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    const match = url.match(/\/carev\/(.+)$/);
    if (match) return match[1];
  }
  return url;
};

const getExtension = (fileName: string): string => {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
};

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const HWP_EXTENSIONS = ['hwp', 'hwpx'];

export default function DocumentViewerModal({
  fileUrl,
  fileName,
  onClose,
  onSave,
  onAutoSave,
  saveLabel = '작성 완료',
}: DocumentViewerModalProps) {
  const [state, setState] = useState<ViewerState>({ kind: 'loading' });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const hwpContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RhwpEditor | null>(null);
  const exportingRef = useRef(false);
  const lastFileRef = useRef<File | null>(null);

  const ext = getExtension(fileName);
  const isHwp = HWP_EXTENSIONS.includes(ext);
  const isAuthoring = !!onSave && isHwp;

  useEffect(() => {
    let cancelled = false;

    const createObjectUrl = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);
      return url;
    };

    // HWPX(ZIP 포맷)에 내장된 첫 페이지 미리보기 이미지 — 에디터 로드 실패 시 폴백
    const tryHwpxPreviewFallback = async (blob: Blob): Promise<boolean> => {
      if (ext !== 'hwpx') return false;
      try {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(blob);
        const previewImage = zip.file('Preview/PrvImage.png');
        if (!previewImage) return false;
        const imageBlob = await previewImage.async('blob');
        if (cancelled) return true;
        setState({
          kind: 'image',
          objectUrl: createObjectUrl(new Blob([imageBlob], { type: 'image/png' })),
          note: '문서 뷰어를 불러오지 못해 첫 페이지 미리보기만 표시합니다.',
        });
        return true;
      } catch {
        return false;
      }
    };

    const load = async () => {
      try {
        const relativePath = extractRelativePath(fileUrl);
        const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(relativePath)}&fileName=${encodeURIComponent(fileName)}`;
        const token = localStorage.getItem('authToken');

        const response = await fetch(downloadUrl, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error('파일을 불러오지 못했습니다.');
        }

        const blob = await response.blob();
        if (cancelled) return;
        blobRef.current = blob;

        if (ext === 'pdf') {
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          setState({ kind: 'pdf', objectUrl: createObjectUrl(pdfBlob) });
          return;
        }

        if (IMAGE_EXTENSIONS.includes(ext)) {
          setState({ kind: 'image', objectUrl: createObjectUrl(blob) });
          return;
        }

        if (isHwp) {
          setState({ kind: 'loading', message: '한글 문서 뷰어를 불러오는 중...' });
          try {
            const { createEditor } = await import('@rhwp/editor');
            if (cancelled || !hwpContainerRef.current) return;

            const editor = await createEditor(hwpContainerRef.current, { studioUrl: STUDIO_URL });
            if (cancelled) {
              editor.destroy();
              return;
            }
            editorRef.current = editor;

            try {
              await editor.loadFile(await blob.arrayBuffer(), fileName);
            } catch (loadError) {
              // 에디터가 "자동 보정" 등 확인 대화상자를 띄우면 사용자가 선택할 때까지
              // 응답이 지연되어 10초 타임아웃이 발생한다. 문서는 이미 전달된 상태이므로
              // 타임아웃은 성공으로 간주하고 에디터를 그대로 보여준다.
              const message = loadError instanceof Error ? loadError.message : '';
              if (!message.includes('Request timeout')) throw loadError;
            }
            if (cancelled) return;
            setState({ kind: 'hwp' });
          } catch (editorError) {
            console.error('한글 문서 뷰어 로드 실패:', editorError);
            editorRef.current?.destroy();
            editorRef.current = null;
            const fallbackShown = await tryHwpxPreviewFallback(blob);
            if (!fallbackShown && !cancelled) {
              setState({
                kind: 'unsupported',
                message: '한글 문서 뷰어를 불러오지 못했습니다.\n다운로드 후 확인해주세요.',
              });
            }
          }
          return;
        }

        setState({
          kind: 'unsupported',
          message: `${ext ? `.${ext}` : '이'} 형식은 브라우저 미리보기를 지원하지 않습니다.\n다운로드 후 확인해주세요.`,
        });
      } catch (error) {
        console.error('문서 미리보기 실패:', error);
        if (!cancelled) {
          setState({ kind: 'error', message: '파일을 불러오는 중 오류가 발생했습니다.' });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, fileName]);

  // 스튜디오 패치의 isDirty 메서드를 직접 postMessage로 조회 (래퍼에는 없는 메서드)
  const requestIsDirty = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      const iframe = editorRef.current?.element;
      if (!iframe?.contentWindow) {
        resolve(false);
        return;
      }
      const id = `carev-dirty-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(false);
      }, 3000);
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'rhwp-response' && e.data.id === id) {
          clearTimeout(timer);
          window.removeEventListener('message', onMessage);
          resolve(Boolean(e.data.result));
        }
      };
      window.addEventListener('message', onMessage);
      iframe.contentWindow.postMessage({ type: 'rhwp-request', id, method: 'isDirty' }, '*');
    });
  }, []);

  // 현재 편집 상태를 File로 내보내기
  const exportCurrentFile = useCallback(async (): Promise<File | null> => {
    const editor = editorRef.current;
    if (!editor) return null;

    let bytes: Uint8Array;
    let outName = fileName;
    if (ext === 'hwpx') {
      try {
        bytes = await editor.exportHwpx();
      } catch {
        // HWPX 직렬화가 안 되는 문서는 HWP로 변환 저장
        bytes = await editor.exportHwp();
        outName = fileName.replace(/\.hwpx$/i, '.hwp');
      }
    } else {
      bytes = await editor.exportHwp();
    }

    return new File([bytes as BlobPart], outName, {
      type: outName.endsWith('.hwpx') ? 'application/vnd.hancom.hwpx' : 'application/x-hwp',
    });
  }, [ext, fileName]);

  // 조용한 저장 (Ctrl+S / 자동 저장): 파일만 갱신하고 표시등 업데이트
  const silentSave = useCallback(async (): Promise<boolean> => {
    if (exportingRef.current) return false;
    exportingRef.current = true;
    try {
      const file = await exportCurrentFile();
      if (!file) return false;
      lastFileRef.current = file;
      onAutoSave?.(file);
      setLastSavedAt(new Date());
      return true;
    } catch (error) {
      console.warn('자동 저장 실패 (다음 주기에 재시도):', error);
      return false;
    } finally {
      exportingRef.current = false;
    }
  }, [exportCurrentFile, onAutoSave]);

  // 에디터 안에서 Ctrl+S / 파일>저장을 누르면 스튜디오 패치가 부모로 이벤트를 보낸다
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'rhwp-event' || e.data.event !== 'save-requested') return;
      // 우리 에디터 iframe에서 온 이벤트인지 확인
      if (e.source !== editorRef.current?.element?.contentWindow) return;

      if (isAuthoring) {
        silentSave();
      } else if (blobRef.current) {
        // 조회 모드의 Ctrl+S는 다운로드로 처리
        const url = URL.createObjectURL(blobRef.current);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isAuthoring, silentSave, fileName]);

  // 자동 저장: 편집 모드에서 30초마다, 문서가 수정된 경우에만
  useEffect(() => {
    if (!isAuthoring || state.kind !== 'hwp') return;
    const timer = setInterval(async () => {
      if (exportingRef.current) return;
      const dirty = await requestIsDirty();
      if (dirty) await silentSave();
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [isAuthoring, state.kind, requestIsDirty, silentSave]);

  // 이미 받아둔 blob으로 즉시 다운로드
  const handleDownload = () => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 작성 완료: 최종 내보내기 후 onSave로 전달 (부모가 첨부 + 기안 화면 전환)
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      const file = await exportCurrentFile();
      if (!file) throw new Error('편집기가 준비되지 않았습니다.');
      onSave(file);
    } catch (error) {
      console.error('문서 저장 실패:', error);
      // 마지막 자동 저장본이라도 있으면 그걸로 전달
      if (lastFileRef.current) {
        onSave(lastFileRef.current);
      } else {
        alert('작성한 문서를 저장하는 데 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 닫기: 편집 모드에서 저장했거나 수정 중이던 문서가 있으면 작성 완료와 동일하게 처리
  const handleClose = async () => {
    if (isAuthoring && state.kind === 'hwp' && !isSaving) {
      const dirty = await requestIsDirty();
      if (dirty || lastFileRef.current) {
        setIsSaving(true);
        try {
          const file = await exportCurrentFile();
          const finalFile = file || lastFileRef.current;
          if (finalFile && onSave) {
            onSave(finalFile);
            return;
          }
        } catch {
          if (lastFileRef.current && onSave) {
            onSave(lastFileRef.current);
            return;
          }
        } finally {
          setIsSaving(false);
        }
      }
    }
    onClose();
  };

  const showSaveButton = isAuthoring && state.kind === 'hwp';
  const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      purpose="info"
      width={isHwp ? 1152 : 896}
      maxHeight="95vh"
    >
      <div style={{ height: '92vh', display: 'flex', flexDirection: 'column' }}>
        <Layout
          height="fill"
          header={
            <LayoutHeader hasDivider>
              <HStack hAlign="between" vAlign="center" gap={3}>
                {/* 왼쪽: 파일 아이콘 + 이름 + 저장 표시등 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: 'var(--color-background-teal)',
                      borderRadius: 'var(--radius-inner)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={FiFileText} color="accent" size="sm" />
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <Text type="body" weight="bold" maxLines={1}>{fileName}</Text>
                  </div>
                  {lastSavedAt && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-1)',
                        flexShrink: 0,
                        background: 'var(--color-background-teal)',
                        color: 'var(--color-text-teal)',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      <Icon icon={FiCloud} color="inherit" size="xsm" />
                      <Text type="supporting" weight="medium" color="inherit">저장됨 {formatTime(lastSavedAt)}</Text>
                    </div>
                  )}
                </div>
                {/* 오른쪽: 액션 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexShrink: 0 }}>
                  {showSaveButton && (
                    <Button
                      label={isSaving ? '저장 중...' : saveLabel}
                      variant="primary"
                      size="sm"
                      icon={<Icon icon={FiCheck} size="sm" />}
                      isLoading={isSaving}
                      isDisabled={isSaving}
                      onClick={handleSave}
                    />
                  )}
                  <Button
                    label="다운로드"
                    variant="secondary"
                    size="sm"
                    icon={<Icon icon={FiDownload} size="sm" />}
                    isDisabled={!blobRef.current || state.kind === 'loading'}
                    onClick={handleDownload}
                  />
                  <Button
                    label="닫기"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Icon icon="close" size="sm" />}
                    onClick={handleClose}
                  />
                </div>
              </HStack>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={0} isScrollable={false}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* 안내 배너 */}
                {state.kind === 'image' && state.note && (
                  <Banner status="warning" container="section" title={state.note} />
                )}
                {showSaveButton && (
                  <Banner
                    status="info"
                    container="section"
                    title={
                      <span>
                        <strong>Ctrl+S</strong> 또는 30초마다 자동 저장됩니다. 닫으면 작성 내용이 자동으로 첨부돼요.
                      </span>
                    }
                  />
                )}

                {/* 본문 */}
                <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-background-muted)', position: 'relative' }}>
                  {/* HWP 에디터 컨테이너 — createEditor가 iframe을 붙이므로 항상 렌더링 */}
                  <div
                    ref={hwpContainerRef}
                    style={{ width: '100%', height: '100%', display: state.kind === 'hwp' ? 'block' : 'none' }}
                  />

                  {state.kind === 'loading' && (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Spinner size="lg" label={state.message || '문서를 불러오는 중...'} />
                    </div>
                  )}

                  {state.kind === 'pdf' && (
                    <iframe
                      src={state.objectUrl}
                      title={fileName}
                      style={{ width: '100%', height: '100%', border: 0 }}
                    />
                  )}

                  {state.kind === 'image' && (
                    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--spacing-6)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={state.objectUrl}
                        alt={fileName}
                        style={{ maxWidth: '100%', background: 'var(--color-background-card)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: 'var(--radius-inner)' }}
                      />
                    </div>
                  )}

                  {(state.kind === 'unsupported' || state.kind === 'error') && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-4)', padding: 'var(--spacing-6)' }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          background: 'var(--color-background-muted)',
                          borderRadius: 'var(--radius-full)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon icon={FiAlertCircle} size="lg" color="tertiary" />
                      </div>
                      <div style={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
                        <Text type="body" color="secondary">{state.message}</Text>
                      </div>
                      {state.kind === 'unsupported' && blobRef.current && (
                        <Button
                          label="파일 다운로드"
                          variant="primary"
                          size="sm"
                          icon={<Icon icon={FiDownload} size="sm" />}
                          onClick={handleDownload}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </LayoutContent>
          }
        />
      </div>
    </Dialog>
  );
}
