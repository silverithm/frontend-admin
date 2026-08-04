'use client';

import { FormSchema } from '@/types/formSchema';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import FormRenderer from './FormRenderer';

interface FormPreviewProps {
  schema: FormSchema;
  /** 양식에 지정된 기본 결재선 — 미리보기 결재란에 그대로 반영 */
  approvalLine?: { name: string }[];
}

/**
 * 폼 미리보기.
 * 렌더링 규칙(폭·조건부 표시·자동 계산·반복 항목)이 실제 작성 화면과 어긋나면
 * 미리보기의 의미가 없으므로, 실제 기안 작성과 동일한 공문형(documentFrame)
 * FormRenderer를 읽기 전용으로 그대로 재사용한다.
 */
export default function FormPreview({ schema, approvalLine }: FormPreviewProps) {
  if (schema.fields.length === 0) {
    return <EmptyState title="미리볼 필드가 없습니다" />;
  }

  const companyName =
    (typeof window !== 'undefined' && localStorage.getItem('companyName')) || '기관명';

  return (
    <FormRenderer
      schema={schema}
      readOnly
      onSubmit={() => {
        /* 미리보기에서는 제출하지 않는다 */
      }}
      documentFrame={{
        companyName,
        title: '(제목은 기안 작성 시 입력합니다)',
        requesterName: '기안자',
        approvalLine,
      }}
    />
  );
}
