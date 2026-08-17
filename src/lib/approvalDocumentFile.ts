/**
 * 결재 상세의 "채팅방에 공지 등록" 흐름에서, 공문 자체를 파일로 만들어 채팅에 올리기 위한 유틸.
 *
 * 기안 유형에 따라 소스가 다르다:
 * - 첨부파일이 있는 기안(파일형·혼합형) → 그 첨부를 그대로 재사용한다.
 * - 첨부가 없는 온라인 폼형 → 결재 상세에 이미 렌더된 공문 DOM(.carev-doc-page)을 PDF로 만든다.
 */

import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { ApprovalRequest } from '@/types/approval';
import { MAX_CHAT_FILE_SIZE } from '@/lib/chatAttachments';

const OFFICIAL_DOC_SELECTOR = '.carev-doc-page';

function sanitizeFileNamePart(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned.slice(0, 80) || '문서';
}

function formatFileDate(value?: string): string {
  const d = value ? new Date(value) : new Date();
  return format(Number.isNaN(d.getTime()) ? new Date() : d, 'yyyy-MM-dd');
}

function buildDocumentFileName(approval: ApprovalRequest, extension: string): string {
  return `공문_${sanitizeFileNamePart(approval.title)}_${formatFileDate(approval.processedAt)}.${extension}`;
}

/** 결재 상세 화면에 렌더된 공문 DOM을 캡처해 A4 PDF로 만든다 (여러 페이지면 분할) */
export async function generateOfficialDocumentPdf(approval: ApprovalRequest): Promise<File> {
  const element = document.querySelector<HTMLElement>(OFFICIAL_DOC_SELECTOR);
  if (!element) {
    throw new Error('공문 화면을 찾을 수 없습니다. 결재 상세를 연 상태에서 다시 시도해주세요');
  }

  // 인쇄 버튼 등 화면 전용 요소는 문서에 포함하지 않는다 (carev-doc-noprint)
  // PNG는 A4 한 장에 수 MB가 나와 업로드 프록시(Vercel)의 요청 본문 한도(4.5MB)에
  // 걸린다 — 흰 배경 문서는 JPEG 고품질이면 수백 KB로 충분하다.
  const dataUrl = await htmlToImage.toJpeg(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    quality: 0.92,
    width: element.scrollWidth,
    height: element.scrollHeight,
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains('carev-doc-noprint')),
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (element.scrollHeight * imgWidth) / element.scrollWidth;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output('blob');
  return new File([blob], buildDocumentFileName(approval, 'pdf'), { type: 'application/pdf' });
}

// S3 URL에서 상대 경로 추출 (ApprovalDetail.tsx의 handleDownloadAttachment와 동일한 규칙)
function extractRelativePath(url: string): string {
  if (url.startsWith('https://') || url.startsWith('http://')) {
    const match = url.match(/\/carev\/(.+)$/);
    if (match) return match[1];
  }
  return url;
}

/** 기안에 이미 붙은 첨부파일을 그대로 내려받아 File로 만든다 */
export async function fetchApprovalAttachmentAsFile(approval: ApprovalRequest): Promise<File> {
  if (!approval.attachmentUrl) {
    throw new Error('첨부파일이 없습니다');
  }
  const fileName = approval.attachmentFileName || buildDocumentFileName(approval, 'bin');
  const relativePath = extractRelativePath(approval.attachmentUrl);
  const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(relativePath)}&fileName=${encodeURIComponent(fileName)}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const response = await fetch(downloadUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('첨부파일을 불러오지 못했습니다');
  }
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
}

/**
 * 공지 등록에 함께 올릴 공문 파일을 만든다.
 * 첨부가 있으면 그 파일을, 없으면(온라인 폼형) 렌더된 공문을 PDF로 변환해 돌려준다.
 * 채팅 파일 전송 용량 제한을 넘으면 업로드해도 어차피 실패하므로 여기서 바로 막는다.
 */
export async function buildApprovalDocumentFile(approval: ApprovalRequest): Promise<File> {
  const file = approval.attachmentUrl
    ? await fetchApprovalAttachmentAsFile(approval)
    : await generateOfficialDocumentPdf(approval);

  if (file.size > MAX_CHAT_FILE_SIZE) {
    throw new Error(`공문 파일이 너무 커서(${(file.size / 1024 / 1024).toFixed(1)}MB) 채팅에 올릴 수 없습니다`);
  }
  return file;
}
