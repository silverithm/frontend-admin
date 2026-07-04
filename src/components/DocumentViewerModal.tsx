'use client';

import { useState, useEffect, useRef } from 'react';
import { FiDownload, FiFileText, FiAlertCircle } from 'react-icons/fi';
import type { RhwpEditor } from '@rhwp/editor';
import { Dialog } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout';
import { HStack, StackItem } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { Spinner } from '@astryxdesign/core/Spinner';

interface DocumentViewerModalProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  /** 지정하면 HWP/HWPX 편집 후 "작성 완료" 버튼으로 파일을 돌려받는다 (기안 작성용) */
  onSave?: (file: File) => void;
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
  saveLabel = '작성 완료',
}: DocumentViewerModalProps) {
  const [state, setState] = useState<ViewerState>({ kind: 'loading' });
  const [isSaving, setIsSaving] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const hwpContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RhwpEditor | null>(null);

  const ext = getExtension(fileName);
  const isHwp = HWP_EXTENSIONS.includes(ext);

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

            // 셀프호스팅 rhwp-studio (public/rhwp-studio/) — 문서가 외부 오리진 iframe으로 나가지 않도록 한다
            const editor = await createEditor(hwpContainerRef.current, {
              studioUrl: '/rhwp-studio/index.html',
            });
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

  // 에디터에서 편집한 문서를 파일로 내보내 onSave로 전달
  const handleSave = async () => {
    const editor = editorRef.current;
    if (!editor || !onSave) return;

    setIsSaving(true);
    try {
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

      const file = new File([bytes as BlobPart], outName, {
        type: outName.endsWith('.hwpx') ? 'application/vnd.hancom.hwpx' : 'application/x-hwp',
      });
      onSave(file);
    } catch (error) {
      console.error('문서 저장 실패:', error);
      alert('작성한 문서를 저장하는 데 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const showSaveButton = !!onSave && isHwp && state.kind === 'hwp';

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      purpose="info"
      width={isHwp ? 1152 : 896}
      maxHeight="92vh"
    >
      <Layout
        height="fill"
        header={
          <LayoutHeader hasDivider>
            <HStack hAlign="between" vAlign="center" gap={2} width="100%">
              <StackItem size="fill">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: '#ccfbf1',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={FiFileText} color="accent" />
                  </div>
                  <Text type="large" weight="bold" maxLines={1}>{fileName}</Text>
                </div>
              </StackItem>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {showSaveButton && (
                  <Button
                    label={isSaving ? '저장 중...' : saveLabel}
                    variant="primary"
                    size="sm"
                    icon={<Icon icon="check" />}
                    isLoading={isSaving}
                    onClick={handleSave}
                  />
                )}
                <Button
                  label="다운로드"
                  variant="secondary"
                  size="sm"
                  icon={<Icon icon={FiDownload} />}
                  isDisabled={!blobRef.current || state.kind === 'loading'}
                  onClick={handleDownload}
                />
                <Button
                  label="닫기"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Icon icon="close" />}
                  onClick={onClose}
                />
              </div>
            </HStack>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={0} isScrollable={false}>
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(92vh - 60px)' }}>
              {/* 안내 배너 */}
              {state.kind === 'image' && state.note && (
                <Banner status="warning" container="section" title={state.note} />
              )}
              {showSaveButton && (
                <Banner
                  status="info"
                  container="section"
                  title={
                    <>
                      문서를 웹에서 바로 작성한 뒤 <strong>{saveLabel}</strong> 버튼을 누르면 자동으로 첨부됩니다.
                    </>
                  }
                />
              )}

              {/* 본문 */}
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#f3f4f6', position: 'relative' }}>
                {/* HWP 에디터 컨테이너 — createEditor가 iframe을 붙이므로 항상 렌더링 */}
                <div
                  ref={hwpContainerRef}
                  style={{ width: '100%', height: '100%', display: state.kind === 'hwp' ? 'block' : 'none' }}
                />

                {state.kind === 'loading' && (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
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
                  <div
                    style={{
                      minHeight: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      padding: 24,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.objectUrl}
                      alt={fileName}
                      style={{
                        maxWidth: '100%',
                        background: '#ffffff',
                        borderRadius: 8,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                  </div>
                )}

                {(state.kind === 'unsupported' || state.kind === 'error') && (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 16,
                      padding: 24,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        background: '#e5e7eb',
                        borderRadius: '9999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon icon={FiAlertCircle} size="lg" color="secondary" />
                    </div>
                    <div style={{ whiteSpace: 'pre-line', textAlign: 'center' }}>
                      <Text type="body" color="secondary">{state.message}</Text>
                    </div>
                    {state.kind === 'unsupported' && blobRef.current && (
                      <Button
                        label="파일 다운로드"
                        variant="primary"
                        size="sm"
                        icon={<Icon icon={FiDownload} />}
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
    </Dialog>
  );
}
