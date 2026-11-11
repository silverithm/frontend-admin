'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormSchema } from '@/types/formSchema';
import { blankApprovalHeaders, parseFormSchema } from '@/lib/blankForm';
import BlankFormDocument from './BlankFormDocument';
import { printDocumentElement } from './printDocument';

interface BlankFormTarget {
  name: string;
  formSchema?: unknown;
}

interface BlankFormJob {
  title: string;
  schema: FormSchema;
  approvalHeaders: string[];
}

/**
 * '빈 서식 인쇄' — 양식을 화면 밖에 한 번 그려서 바로 인쇄 창을 연다.
 *
 * 미리보기 창을 따로 띄우지 않는다: 브라우저 인쇄 창이 이미 미리보기이고,
 * 거기서 'PDF로 저장'도 된다. 단추 한 번에 종이가 나오는 게 이 기능의 목적이다.
 *
 * printBlankForm(양식, 기본 결재선 단계 수) — 단계 수가 결재란 칸 수가 된다.
 */
export function useBlankFormPrint(companyName: string) {
  const [job, setJob] = useState<BlankFormJob | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job || !pageRef.current) return;
    // 복제는 동기로 끝나므로 바로 치워도 인쇄물에는 남는다
    printDocumentElement(pageRef.current, `${job.title} (빈 서식)`);
    setJob(null);
  }, [job]);

  const printBlankForm = useCallback((template: BlankFormTarget, approvalStepCount: number) => {
    const schema = parseFormSchema(template.formSchema);
    if (!schema) return false;
    setJob({ title: template.name, schema, approvalHeaders: blankApprovalHeaders(approvalStepCount) });
    return true;
  }, []);

  const printElement =
    job && typeof document !== 'undefined'
      ? createPortal(
          // 화면에는 보이지 않게 밖으로 — display:none이면 복제할 레이아웃이 없다
          <div aria-hidden style={{ position: 'fixed', left: '-10000px', top: 0, width: '794px', pointerEvents: 'none' }}>
            <BlankFormDocument
              pageRef={pageRef}
              title={job.title}
              schema={job.schema}
              companyName={companyName}
              approvalHeaders={job.approvalHeaders}
            />
          </div>,
          document.body,
        )
      : null;

  return { printBlankForm, printElement };
}
