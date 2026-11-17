'use client';

import { useState } from 'react';
import { buildSampleApproval } from './templatePreview';
import FormPreview from './FormPreview';
import OfficialDocument from './OfficialDocument';
import { FormSchema } from '@/types/formSchema';
import { ApproverCandidate } from '@/types/approval';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { SegmentedControl } from '@/components/ui/SlidingSegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 저장 전 고치는 중인 모습 그대로 */
  schema: FormSchema;
  templateName?: string;
  defaultApprovalLine?: ApproverCandidate[];
  /** 공문 머리의 기관명 — 없으면 로그인 때 남긴 기관명 */
  companyName?: string;
}

/**
 * 양식 미리보기 창 — 공문(결재 완료 모습) / 입력 양식(직원이 쓰는 칸) 전환.
 *
 * 2026-11-17: 편집 창 맨 아래(버전 기록 옆)에서도 열 수 있게 폼 빌더 안에서 꺼내 왔다. 예전에는 '온라인 폼 구성'
 * 항목 목록 밑 도구 줄에만 있어서, 항목이 많으면 한참 내려가야 보였다.
 */
export default function TemplatePreviewDialog({
  isOpen,
  onClose,
  schema,
  templateName,
  defaultApprovalLine,
  companyName,
}: Props) {
  const [previewMode, setPreviewMode] = useState<'document' | 'form'>('document');
  const company =
    companyName ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('companyName') || localStorage.getItem('organizationName') || '기관명'
      : '기관명');

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      purpose="info"
      width={previewMode === 'document' ? 880 : 672}
      maxHeight="90vh"
    >
      <Layout
        header={
          <DialogHeader
            title="양식 미리보기"
            subtitle={previewMode === 'document'
              ? '결재 완료 시 공문(표준 기안문) 형태 예시입니다'
              : '직원이 작성하는 입력 양식 형태입니다'}
            onOpenChange={(open) => { if (!open) onClose(); }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <SegmentedControl
                value={previewMode}
                onChange={(value) => setPreviewMode(value as 'document' | 'form')}
                label="미리보기 형태"
              >
                <SegmentedControlItem value="document" label="공문 미리보기" />
                <SegmentedControlItem value="form" label="입력 양식" />
              </SegmentedControl>

              {previewMode === 'document' ? (
                <div style={{ background: 'var(--color-background-muted)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-inner)', overflowX: 'auto' }}>
                  <OfficialDocument
                    approval={buildSampleApproval(schema, templateName, defaultApprovalLine)}
                    schema={schema}
                    companyName={company}
                    showPrintButton={false}
                  />
                </div>
              ) : (
                <FormPreview schema={schema} approvalLine={defaultApprovalLine} />
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="닫기" variant="secondary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
