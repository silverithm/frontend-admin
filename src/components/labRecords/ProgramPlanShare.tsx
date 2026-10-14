'use client';

/** 보호자 제공 표시 — 2026 평가 17 소통노력 기준③: 월간 프로그램 계획표를 한 달에 1회 이상 보호자께 제공한 증빙(제공일·방법). */
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Button } from '@astryxdesign/core/Button';
import type { ScheduleSharedMethod } from '@/lib/lab/labTypes';
import { SHARED_METHODS } from '@/lib/lab/programPlanRules';
import { Chip, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { todayString } from '@/components/lab/labFormat';
import { MAX_SCHEDULE_NOTES } from './ProgramPlanDraft';
import styles from './labRecords.module.css';
import own from './ProgramPlan.module.css';

interface Props {
  sharedOn: string;
  sharedMethod: ScheduleSharedMethod | null;
  notes: string;
  onSharedOn: (value: string) => void;
  onSharedMethod: (value: ScheduleSharedMethod | null) => void;
  onNotes: (value: string) => void;
}

export default function ProgramPlanShare({ sharedOn, sharedMethod, notes, onSharedOn, onSharedMethod, onNotes }: Props) {
  const done = sharedOn !== '' && sharedMethod !== null;
  return (
    <Card padding={4}>
      <div className={own.dayPanel}>
        <div className={styles.toolbar}>
          <Text type="large" weight="semibold">
            보호자께 드린 기록
          </Text>
          {done ? <Chip tone="ok" label="제공 기록 있음" /> : <Chip tone="warn" label="제공 기록 없음" />}
        </div>
        <SupportText>평가 17 소통노력 기준③은 월간 프로그램 계획표를 한 달에 1회 이상 보호자께 제공하는 것입니다. 인쇄해 드리거나 보낸 날과 방법을 남겨 두세요.</SupportText>
        <div className={styles.fieldGrid}>
          <LabDateInput label="제공일" value={sharedOn} onChange={onSharedOn} />
          <Selector
            label="제공 방법"
            placeholder="방법 고르기"
            options={SHARED_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            value={sharedMethod ?? ''}
            onChange={(v) => onSharedMethod(v ? (v as ScheduleSharedMethod) : null)}
          />
        </div>
        {(sharedOn !== '' || sharedMethod !== null) && (
          <div>
            <Button
              label="제공 기록 지우기"
              variant="ghost"
              onClick={() => {
                onSharedOn('');
                onSharedMethod(null);
              }}
            />
          </div>
        )}
        {sharedOn > todayString() && <SupportText tone="warn">제공일이 오늘 이후입니다. 아직 드리지 않았다면 드린 뒤에 적어 주세요.</SupportText>}
        <TextArea label="계획표 메모 (선택)" description="보호자용 인쇄물 아래에 함께 나옵니다" placeholder="예: 10월 22일은 현장학습으로 오후 프로그램이 없습니다" value={notes} onChange={onNotes} rows={3} maxLength={MAX_SCHEDULE_NOTES} />
      </div>
    </Card>
  );
}
