'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FormSchema } from '@/types/formSchema';
import {
  BLANK_PAGE_CONTENT_WIDTH,
  blankApprovalHeaders,
  blankExtraTableLines,
  blankFormFitsOnePage,
  parseFormSchema,
} from '@/lib/blankForm';
import BlankFormDocument from './BlankFormDocument';
import { groupFieldsIntoRows } from './formValueFormat';
import { printDocumentElement } from './printDocument';

interface BlankFormTarget {
  name: string;
  formSchema?: unknown;
}

interface BlankFormJob {
  title: string;
  schema: FormSchema;
  approvalHeaders: string[];
  sealUrl: string | null;
  /** 반복 항목 표에 더 그릴 줄 수 — null이면 아직 재지 않았다 */
  extraTableLines: number | null;
}

export interface BlankFormPrintOptions {
  /** 기관 직인을 찍어 인쇄 — 직인 주소를 넘긴다 */
  sealUrl?: string | null;
}

/** 화면에서 그릴 때 종이 안쪽 여백(.carev-doc-page padding: 48px 44px) — 인쇄에서는 @page 여백이 대신한다 */
const SCREEN_PADDING_X = 44;

/**
 * 종이에 실릴 내용의 높이 — 첫 칸 위에서 마지막 칸 아래(아래 여백 포함)까지.
 * 종이 자체는 min-height로 늘 한 장 높이라 그 높이로는 알 수 없다.
 */
function measureContentHeight(page: HTMLElement): number {
  const first = page.firstElementChild;
  const last = page.lastElementChild;
  if (!first || !last) return 0;
  const marginBottom = parseFloat(getComputedStyle(last).marginBottom) || 0;
  return last.getBoundingClientRect().bottom + marginBottom - first.getBoundingClientRect().top;
}

/**
 * '빈 서식 인쇄' — 양식을 화면 밖에 한 번 그려서 바로 인쇄 창을 연다.
 *
 * 미리보기 창을 따로 띄우지 않는다: 브라우저 인쇄 창이 이미 미리보기이고,
 * 거기서 'PDF로 저장'도 된다. 단추 한 번에 종이가 나오는 게 이 기능의 목적이다.
 *
 * printBlankForm(양식, 기본 결재선 단계 수, { sealUrl }) — 단계 수가 결재란 칸 수가 된다.
 *
 * 한 장에 들어가는 서식은 쓰는 칸을 종이 아래까지 늘린다(carev-doc-page--fit).
 * 긴 글 칸 없이 표가 본문인 서식은 남는 자리에 표 줄을 더 그린다.
 * 손으로 쓰려고 뽑는 종이인데 칸은 좁고 아래 절반이 비어 나오던 것을 고친 것 (2026-11-12).
 */
export function useBlankFormPrint(companyName: string) {
  const [job, setJob] = useState<BlankFormJob | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!job || !page) return;
    // 인쇄 폭으로 그려 둔 것을 잰다
    const naturalHeight = measureContentHeight(page);
    if (job.extraTableLines === null) {
      // 긴 글 칸이 없는 표 서식은 남는 종이에 표 줄을 더 그린다 — 줄 수를 정해 한 번 더 그린 뒤 인쇄한다
      const rowHeights = Array.from(page.querySelectorAll(':scope > .carev-doc-fields > .carev-doc-field-row'))
        .map((row) => row.getBoundingClientRect().height);
      const extra = blankExtraTableLines(groupFieldsIntoRows(job.schema.fields), rowHeights, naturalHeight);
      if (extra > 0) {
        setJob({ ...job, extraTableLines: extra });
        return;
      }
    }
    // 한 장에 들어가면 칸을 늘리는 배치로 바꾼다
    if (blankFormFitsOnePage(naturalHeight)) page.classList.add('carev-doc-page--fit');
    // 복제는 동기로 끝나므로 바로 치워도 인쇄물에는 남는다
    printDocumentElement(page, `${job.title} (빈 서식)`);
    setJob(null);
  }, [job]);

  const printBlankForm = useCallback(
    (template: BlankFormTarget, approvalStepCount: number, options?: BlankFormPrintOptions) => {
      const schema = parseFormSchema(template.formSchema);
      if (!schema) return false;
      setJob({
        title: template.name,
        schema,
        approvalHeaders: blankApprovalHeaders(approvalStepCount),
        sealUrl: options?.sealUrl || null,
        extraTableLines: null,
      });
      return true;
    },
    [],
  );

  const printElement =
    job && typeof document !== 'undefined'
      ? createPortal(
          // 화면에는 보이지 않게 밖으로 — display:none이면 복제할 레이아웃이 없다.
          // 폭은 인쇄 용지의 서식 폭(180mm)에 화면 여백을 더한 값 — 줄바꿈이 인쇄와 같아야 높이를 바르게 잰다
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: '-10000px',
              top: 0,
              width: `${BLANK_PAGE_CONTENT_WIDTH + SCREEN_PADDING_X * 2}px`,
              pointerEvents: 'none',
            }}
          >
            <BlankFormDocument
              pageRef={pageRef}
              title={job.title}
              schema={job.schema}
              companyName={companyName}
              approvalHeaders={job.approvalHeaders}
              sealUrl={job.sealUrl}
              extraTableLines={job.extraTableLines ?? 0}
            />
          </div>,
          document.body,
        )
      : null;

  return { printBlankForm, printElement };
}
