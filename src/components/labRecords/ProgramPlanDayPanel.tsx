'use client';

/** 달력에서 고른 날의 프로그램 목록과 추가·고치기 폼. 변경은 바로 계획표(저장 전 상태)에 반영되고, 저장은 계획표 위쪽 단추로 한다. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Selector } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { ScheduleItem } from '@/lib/lab/labTypes';
import { MAX_SCHEDULE_INSTRUCTOR, MAX_SCHEDULE_TITLE, SCHEDULE_CATEGORIES } from '@/lib/lab/programPlanRules';
import { Chip, ErrorBanner, LabDateInput, SupportText } from '@/components/lab/LabUi';
import { dateLabel, monthDates, weekdayIndex } from '@/components/lab/labFormat';
import { itemDraftOf, itemOf, mergeItems, newItemDraft, sortItems, validateItem } from './ProgramPlanDraft';
import type { ItemDraft } from './ProgramPlanDraft';
import { TimeField } from './RecordsUi';
import styles from './labRecords.module.css';
import own from './ProgramPlan.module.css';

const categoryText = (c: ScheduleItem['category']) => SCHEDULE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

interface Props {
  month: string;
  date: string;
  /** 달 전체 칸(날짜·시각 순) */
  items: ScheduleItem[];
  operatingDays: ReadonlyArray<string>;
  isOperating: boolean;
  onChange: (items: ScheduleItem[]) => void;
  onClose: () => void;
}

export default function ProgramPlanDayPanel({ month, date, items, operatingDays, isOperating, onChange, onClose }: Props) {
  const [target, setTarget] = useState<ScheduleItem | 'new' | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(() => newItemDraft(date));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dayItems = items.filter((i) => i.date.slice(0, 10) === date);

  const open = (next: ScheduleItem | 'new') => {
    setTarget(next);
    setDraft(next === 'new' ? newItemDraft(date) : itemDraftOf(next));
    setError(null);
    setNotice(null);
  };

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const problem = validateItem(draft, month, items.length, target === 'new');
    if (problem) {
      setError(problem);
      return;
    }
    const item = itemOf(draft);
    const rest = target !== 'new' && target !== null ? items.filter((i) => i !== target) : items;
    onChange(sortItems([...rest, item]));
    setTarget(null);
    setError(null);
  };

  const repeatWeekly = () => {
    const problem = validateItem(draft, month, items.length, true);
    if (problem) {
      setError(problem);
      return;
    }
    const base = itemOf(draft);
    const dow = weekdayIndex(base.date);
    const open = new Set(operatingDays);
    // 운영일 중 같은 요일에만 넣는다(쉬는 날에 계획이 생기지 않게). 고른 날 자신은 운영일이 아니어도 넣는다.
    const dates = monthDates(month).filter((d) => weekdayIndex(d) === dow && (open.has(d) || d === base.date));
    const result = mergeItems(items, dates.map((d) => ({ ...base, date: d })));
    onChange(result.items);
    setTarget(null);
    setError(null);
    setNotice(`같은 요일 ${result.added}곳에 넣었습니다${result.skipped > 0 ? ` (이미 있는 ${result.skipped}곳은 건너뜀)` : ''}`);
  };

  const remove = (item: ScheduleItem) => {
    onChange(items.filter((i) => i !== item));
    if (target === item) setTarget(null);
  };

  return (
    <Card padding={4}>
      <div className={own.dayPanel}>
        <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
          <Text type="large" weight="semibold">
            {dateLabel(date)}
          </Text>
          <HStack gap={2} vAlign="center">
            {!isOperating && <Chip tone="neutral" label="쉬는 날" />}
            <Button label="닫기" variant="ghost" onClick={onClose} />
          </HStack>
        </HStack>

        {dayItems.length === 0 && target !== 'new' && <SupportText>이 날 계획한 프로그램이 없습니다.</SupportText>}
        {dayItems.map((it, i) => (
          <div key={`${it.startTime ?? ''}-${it.title}-${i}`} className={own.itemRow}>
            <div className={own.itemRowText}>
              <Text type="label">{it.title}</Text>
              <SupportText>
                {[it.startTime, categoryText(it.category), it.instructor && `강사 ${it.instructor}`].filter(Boolean).join(' · ')}
              </SupportText>
            </div>
            <Button label="고치기" variant="ghost" onClick={() => open(it)} />
            <Button label="삭제" variant="ghost" onClick={() => remove(it)} />
          </div>
        ))}

        {notice && <SupportText>{notice}</SupportText>}

        {target === null ? (
          <div>
            <Button label="프로그램 넣기" variant="secondary" onClick={() => open('new')} />
          </div>
        ) : (
          <VStack gap={3}>
            <Text type="label">{target === 'new' ? '프로그램 넣기' : '프로그램 고치기'}</Text>
            <div className={own.itemForm}>
              <TextInput label="제목" placeholder="예: 노래교실" value={draft.title} onChange={(v) => set('title', v.slice(0, MAX_SCHEDULE_TITLE))} />
              <Selector
                label="분류"
                placeholder="분류 고르기"
                options={SCHEDULE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                value={draft.category}
                onChange={(v) => v && set('category', v as ItemDraft['category'])}
              />
              <TimeField label="시각 (선택)" value={draft.time} onChange={(v) => set('time', v)} />
              <TextInput label="강사 (선택)" placeholder="예: 김OO 선생님" value={draft.instructor} onChange={(v) => set('instructor', v.slice(0, MAX_SCHEDULE_INSTRUCTOR))} />
              <LabDateInput label="날짜" value={draft.date} onChange={(v) => set('date', v)} />
            </div>
            {error && <ErrorBanner message={error} />}
            <HStack gap={2} wrap="wrap">
              <Button label={target === 'new' ? '넣기' : '고침 완료'} variant="primary" onClick={save} />
              {target === 'new' && <Button label="이 달 같은 요일마다 넣기" variant="secondary" onClick={repeatWeekly} />}
              <Button label="취소" variant="ghost" onClick={() => setTarget(null)} />
            </HStack>
            <div className={styles.mutedText}>
              <SupportText>시각을 비워 두면 그날 시각 없이 목록에 나옵니다.</SupportText>
            </div>
          </VStack>
        )}
      </div>
    </Card>
  );
}
