/**
 * 양식 미리보기용 가짜 기안 만들기.
 *
 * 양식 편집기와 양식 관리 목록이 같은 미리보기를 보여줘야 해서 여기에 뒀다 —
 * 한쪽에만 있으면 "편집 중에 본 모습"과 "목록에서 본 모습"이 갈린다.
 */
import { ApprovalRequest, ApproverCandidate } from '@/types/approval';
import { FormSchema } from '@/types/formSchema';

/** 스키마 필드별 예시 값으로 공문 미리보기용 가짜 기안을 만든다.
 *  기본 결재선이 지정돼 있으면 예시 결재선 대신 그것을 그대로 보여준다. */
export function buildSampleApproval(
  schema: FormSchema,
  templateName?: string,
  defaultLine?: ApproverCandidate[],
): ApprovalRequest {
  const now = new Date();
  const nowIso = now.toISOString();
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const formData: Record<string, any> = {};
  for (const field of schema.fields) {
    switch (field.type) {
      case 'section':
        break;
      case 'textarea':
        formData[field.id] = '예시 내용입니다.\n실제 기안 시 작성한 내용이 이 위치에 표시됩니다.';
        break;
      case 'number':
        formData[field.id] = 3;
        break;
      case 'date':
        formData[field.id] = nowIso;
        break;
      case 'dateRange':
        formData[field.id] = { start: nowIso, end: inTwoDays };
        break;
      case 'select':
      case 'radio':
        formData[field.id] = field.options?.[0]?.value ?? '예시';
        break;
      case 'checkbox':
        formData[field.id] = field.options?.length ? [field.options[0].value] : [];
        break;
      case 'file':
        formData[field.id] = { fileName: '첨부파일_예시.pdf' };
        break;
      case 'image':
        // 실제 업로드된 파일이 없어 그릴 이미지가 없다 — 미리보기에서는 빈칸으로 둔다
        break;
      default:
        formData[field.id] = `${field.label} 예시`;
    }
  }

  return {
    id: 'preview',
    templateId: 'preview',
    templateName: templateName || '양식 미리보기',
    title: templateName ? `(예시) ${templateName}` : '(예시) 기안 제목',
    formData,
    requesterId: 'preview',
    requesterName: '홍길동',
    status: 'PENDING',
    createdAt: nowIso,
    hasApprovalLine: true,
    docNumberDisplay: '제 2026-0 호',
    approvalLine: defaultLine && defaultLine.length > 0
      ? defaultLine.map((approver, index) => ({
          id: index + 1,
          stepOrder: index + 1,
          approverType: approver.approverType,
          approverId: String(approver.approverId),
          approverName: approver.name,
          roleLabel: index === defaultLine.length - 1 ? 'FINAL' as const : 'REVIEWER' as const,
          status: 'PENDING' as const,
        }))
      : [
          {
            id: 1,
            stepOrder: 1,
            approverType: 'MEMBER',
            approverId: 'preview-1',
            approverName: '김검토',
            roleLabel: 'REVIEWER',
            status: 'APPROVED',
            processedAt: nowIso,
          },
          {
            id: 2,
            stepOrder: 2,
            approverType: 'ADMIN',
            approverId: 'preview-2',
            approverName: '박원장',
            roleLabel: 'FINAL',
            status: 'PENDING',
          },
        ],
  };
}

