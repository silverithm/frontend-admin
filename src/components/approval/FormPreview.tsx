'use client';

import { FormSchema } from '@/types/formSchema';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import FormRenderer from './FormRenderer';

interface FormPreviewProps {
  schema: FormSchema;
}

/**
 * 폼 미리보기.
 * 렌더링 규칙(폭·조건부 표시·자동 계산·반복 항목)이 실제 작성 화면과 어긋나면
 * 미리보기의 의미가 없으므로 FormRenderer를 읽기 전용으로 그대로 재사용한다.
 */
export default function FormPreview({ schema }: FormPreviewProps) {
  if (schema.fields.length === 0) {
    return <EmptyState title="미리볼 필드가 없습니다" />;
  }

  return (
    <FormRenderer
      schema={schema}
      readOnly
      onSubmit={() => {
        /* 미리보기에서는 제출하지 않는다 */
      }}
    />
  );
}
