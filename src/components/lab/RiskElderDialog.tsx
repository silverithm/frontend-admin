'use client';

/** 어르신 한 분의 위험도 평가 창 — 새 평가와 이력을 오간다. */
import { useState } from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack } from '@astryxdesign/core/Stack';
import type { RiskKind } from '@/lib/lab/labTypes';
import styles from './lab.module.css';
import RiskAssessForm from './RiskAssessForm';
import RiskHistoryPanel from './RiskHistoryPanel';

export type RiskDialogView = 'assess' | 'history';

interface RiskElderDialogProps {
  elderId: number;
  elderName: string;
  initialView: RiskDialogView;
  initialKind: RiskKind;
  onClose: () => void;
  /** 저장·삭제로 현황이 바뀌었을 때 */
  onChanged: () => void;
}

export default function RiskElderDialog({ elderId, elderName, initialView, initialKind, onClose, onChanged }: RiskElderDialogProps) {
  const [view, setView] = useState<RiskDialogView>(initialView);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} purpose="form" width="min(760px, calc(100vw - 24px))" maxHeight="90vh">
      <Layout
        header={<DialogHeader title={`${elderName} · 위험도 평가`} onOpenChange={(open) => !open && onClose()} />}
        content={
          <LayoutContent>
            <div className={styles.kr}>
            <VStack gap={4}>
              <SegmentedControl label="평가 화면" value={view} onChange={(v) => setView(v as RiskDialogView)} size="sm">
                <SegmentedControlItem value="assess" label="새 평가" />
                <SegmentedControlItem value="history" label="이력" />
              </SegmentedControl>
              {/* 입력 중인 점수가 이력 화면을 다녀와도 남도록, 평가 양식은 숨기기만 한다 */}
              <div hidden={view !== 'assess'}>
                <RiskAssessForm
                  elderId={elderId}
                  initialKind={initialKind}
                  onSaved={() => {
                    setRefreshToken((n) => n + 1);
                    onChanged();
                  }}
                />
              </div>
              {view === 'history' && <RiskHistoryPanel elderId={elderId} refreshToken={refreshToken} onChanged={onChanged} />}
            </VStack>
            </div>
          </LayoutContent>
        }
      />
    </Dialog>
  );
}
