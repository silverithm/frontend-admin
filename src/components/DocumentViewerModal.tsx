'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiDownload, FiFileText, FiAlertCircle, FiInfo, FiCheck } from 'react-icons/fi';
import type { RhwpEditor } from '@rhwp/editor';

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

            const editor = await createEditor(hwpContainerRef.current);
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        className={`bg-white rounded-2xl shadow-xl w-full border border-gray-200 h-[92vh] flex flex-col overflow-hidden ${
          isHwp ? 'max-w-6xl' : 'max-w-4xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FiFileText className="w-5 h-5 text-teal-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 truncate">{fileName}</h2>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
            {showSaveButton && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center space-x-1.5 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiCheck className="w-4 h-4" />
                <span>{isSaving ? '저장 중...' : saveLabel}</span>
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={!blobRef.current || state.kind === 'loading'}
              className="flex items-center space-x-1.5 px-3 py-2 text-teal-600 hover:bg-teal-50 border border-teal-200 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiDownload className="w-4 h-4" />
              <span>다운로드</span>
            </button>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 안내 배너 */}
        {state.kind === 'image' && state.note && (
          <div className="px-5 py-2.5 bg-yellow-50 border-b border-yellow-100 flex items-center space-x-2 flex-shrink-0">
            <FiInfo className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-700 text-sm">{state.note}</p>
          </div>
        )}
        {showSaveButton && (
          <div className="px-5 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center space-x-2 flex-shrink-0">
            <FiInfo className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <p className="text-teal-700 text-sm">
              문서를 웹에서 바로 작성한 뒤 <strong>{saveLabel}</strong> 버튼을 누르면 자동으로 첨부됩니다.
            </p>
          </div>
        )}

        {/* 본문 */}
        <div className="flex-1 overflow-auto bg-gray-100 relative">
          {/* HWP 에디터 컨테이너 — createEditor가 iframe을 붙이므로 항상 렌더링 */}
          <div
            ref={hwpContainerRef}
            className="w-full h-full"
            style={{ display: state.kind === 'hwp' ? 'block' : 'none' }}
          />

          {state.kind === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <svg className="animate-spin h-10 w-10 text-teal-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-500 text-sm">{state.message || '문서를 불러오는 중...'}</p>
            </div>
          )}

          {state.kind === 'pdf' && (
            <iframe
              src={state.objectUrl}
              title={fileName}
              className="w-full h-full border-0"
            />
          )}

          {state.kind === 'image' && (
            <div className="min-h-full flex items-start justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.objectUrl}
                alt={fileName}
                className="max-w-full bg-white shadow-md rounded-lg"
              />
            </div>
          )}

          {(state.kind === 'unsupported' || state.kind === 'error') && (
            <div className="h-full flex flex-col items-center justify-center space-y-4 p-6">
              <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
                <FiAlertCircle className="w-7 h-7 text-gray-500" />
              </div>
              <p className="text-gray-600 text-sm text-center whitespace-pre-line">{state.message}</p>
              {state.kind === 'unsupported' && blobRef.current && (
                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm font-medium text-sm"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>파일 다운로드</span>
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
