'use client';

/**
 * 급여제공기록 편집기의 "가져오기" — 같은 날 같은 어르신의 간호일지(바이탈·처치)·프로그램 참여·기능회복훈련·상태변화·사고를 문장으로 보여 준다.
 * 칸을 덮어쓰지 않는다. 제안을 읽고 "넣기"를 눌러야 칸 뒤에 덧붙고, 직원이 고친 뒤 저장한다.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { listCareEvents, listMedicalVisits, listNursingLogsByDate, listPrograms, listRehabSessions } from '@/lib/lab/labApi';
import { rehabCareRecordText } from '@/lib/lab/rehabRules';
import type { CareRecordTextField } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, SupportText } from './LabUi';
import { PROGRAM_FIELD_LABEL, eventSentence, nursingSentence, programSuggestions, visitSentence } from './CareRecordLabImportText';
import type { ProgramSuggestion } from './CareRecordLabImportText';
import { errorText } from './labFormat';
import styles from './lab.module.css';

interface CareRecordLabImportProps {
  elderId: number;
  date: string;
  /** 지금 칸에 적힌 글 — 이미 들어 있는 제안은 "이미 들어 있음"으로 보여 준다 */
  fields: Record<CareRecordTextField, string>;
  /** 칸 뒤에 덧붙인다(편집기가 길이 제한·중복을 처리) */
  onInsert: (field: CareRecordTextField, text: string) => void;
}

interface Loaded<T> {
  state: 'loading' | 'done' | 'error';
  value: T;
  error: string | null;
}

interface Suggestion {
  field: CareRecordTextField;
  label: string;
  text: string;
}

function SuggestionLine({ suggestion, fields, onInsert }: { suggestion: Suggestion; fields: Record<CareRecordTextField, string>; onInsert: CareRecordLabImportProps['onInsert'] }) {
  const present = fields[suggestion.field].includes(suggestion.text);
  return (
    <div className={styles.suggestBox}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Chip tone="info" label={`${suggestion.label} 칸 제안`} />
          {present && <Chip tone="ok" label="이미 들어 있음" />}
        </HStack>
        <div className={styles.pre}>
          <Text type="body">{suggestion.text}</Text>
        </div>
        <HStack gap={2} wrap="wrap">
          <Button
            label={fields[suggestion.field].trim() === '' ? `${suggestion.label} 칸에 넣기` : `${suggestion.label} 칸 뒤에 덧붙이기`}
            size="sm"
            variant="secondary"
            isDisabled={present}
            onClick={() => onInsert(suggestion.field, suggestion.text)}
          />
        </HStack>
      </VStack>
    </div>
  );
}

export default function CareRecordLabImport({ elderId, date, fields, onInsert }: CareRecordLabImportProps) {
  const [nursing, setNursing] = useState<Loaded<Suggestion | null> | null>(null);
  const [programs, setPrograms] = useState<Loaded<{ items: Suggestion[]; skipped: number }> | null>(null);
  const [rehab, setRehab] = useState<Loaded<Suggestion | null> | null>(null);
  const [events, setEvents] = useState<Loaded<Suggestion | null> | null>(null);
  const [visits, setVisits] = useState<Loaded<Suggestion | null> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const importNursing = async () => {
    if (nursing?.state === 'loading') return;
    setNursing({ state: 'loading', value: null, error: null });
    try {
      const logs = await listNursingLogsByDate(date);
      if (!alive.current) return;
      const log = logs.find((l) => l.elderlyId === elderId);
      const text = nursingSentence(log);
      setNursing({ state: 'done', value: text ? { field: 'nursing', label: '간호·처치', text } : null, error: null });
    } catch (e) {
      if (alive.current) setNursing({ state: 'error', value: null, error: errorText(e, '간호일지를 불러오지 못했습니다') });
    }
  };

  const importPrograms = async () => {
    if (programs?.state === 'loading') return;
    setPrograms({ state: 'loading', value: { items: [], skipped: 0 }, error: null });
    try {
      const list = await listPrograms(date.slice(0, 7));
      if (!alive.current) return;
      const { items, skipped } = programSuggestions(list, elderId, date);
      const mapped = items.map((i: ProgramSuggestion) => ({ field: i.field, label: PROGRAM_FIELD_LABEL[i.field], text: i.text }));
      setPrograms({ state: 'done', value: { items: mapped, skipped }, error: null });
    } catch (e) {
      if (alive.current) setPrograms({ state: 'error', value: { items: [], skipped: 0 }, error: errorText(e, '프로그램 일지를 불러오지 못했습니다') });
    }
  };

  // 그날 세션 목록은 어르신 전체가 오므로 이 어르신 것만 고른다
  const importRehab = async () => {
    if (rehab?.state === 'loading') return;
    setRehab({ state: 'loading', value: null, error: null });
    try {
      const list = await listRehabSessions({ date });
      if (!alive.current) return;
      const text = rehabCareRecordText(list.filter((r) => r.elderlyId === elderId && r.sessionDate.slice(0, 10) === date));
      setRehab({ state: 'done', value: text ? { field: 'training', label: '기능회복훈련', text } : null, error: null });
    } catch (e) {
      if (alive.current) setRehab({ state: 'error', value: null, error: errorText(e, '기능회복훈련 기록을 불러오지 못했습니다') });
    }
  };

  // 이 어르신의 사고 기록을 받아 그날 것만 남긴다
  const importEvents = async () => {
    if (events?.state === 'loading') return;
    setEvents({ state: 'loading', value: null, error: null });
    try {
      const list = await listCareEvents({ elderlyId: elderId });
      if (!alive.current) return;
      const text = eventSentence(list, elderId, date);
      setEvents({ state: 'done', value: text ? { field: 'specialNote', label: '특이사항', text } : null, error: null });
    } catch (e) {
      if (alive.current) setEvents({ state: 'error', value: null, error: errorText(e, '상태변화·사고 기록을 불러오지 못했습니다') });
    }
  };

  // 이 어르신의 진료 동행 기록을 받아 그날 것만 남긴다(다른 가져오기와 따로 실패한다)
  const importVisits = async () => {
    if (visits?.state === 'loading') return;
    setVisits({ state: 'loading', value: null, error: null });
    try {
      const list = await listMedicalVisits({ elderlyId: elderId });
      if (!alive.current) return;
      const text = visitSentence(list, elderId, date);
      setVisits({ state: 'done', value: text ? { field: 'specialNote', label: '특이사항', text } : null, error: null });
    } catch (e) {
      if (alive.current) setVisits({ state: 'error', value: null, error: errorText(e, '진료 동행 기록을 불러오지 못했습니다') });
    }
  };

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text type="label">다른 기록에서 가져오기</Text>
        <Button label="간호일지 가져오기" size="sm" variant="secondary" isLoading={nursing?.state === 'loading'} onClick={() => void importNursing()} />
        <Button label="프로그램 가져오기" size="sm" variant="secondary" isLoading={programs?.state === 'loading'} onClick={() => void importPrograms()} />
        <Button label="기능회복훈련 가져오기" size="sm" variant="secondary" isLoading={rehab?.state === 'loading'} onClick={() => void importRehab()} />
        <Button label="상태변화·사고 가져오기" size="sm" variant="secondary" isLoading={events?.state === 'loading'} onClick={() => void importEvents()} />
        <Button label="진료 동행 가져오기" size="sm" variant="secondary" isLoading={visits?.state === 'loading'} onClick={() => void importVisits()} />
      </HStack>
      <SupportText>그날 바이탈·처치, 참여한 프로그램, 기능회복훈련, 상태변화·사고, 진료 동행을 제안으로 보여 드립니다. 칸을 덮어쓰지 않고, 넣기를 눌러야 들어가요.</SupportText>

      {nursing?.state === 'error' && nursing.error && <ErrorBanner message={nursing.error} onRetry={() => void importNursing()} />}
      {nursing?.state === 'done' &&
        (nursing.value ? (
          <SuggestionLine suggestion={nursing.value} fields={fields} onInsert={onInsert} />
        ) : (
          <SupportText>그날 이 어르신의 간호일지(바이탈·처치)가 없습니다. 간호일지를 먼저 적어 주세요.</SupportText>
        ))}

      {programs?.state === 'error' && programs.error && <ErrorBanner message={programs.error} onRetry={() => void importPrograms()} />}
      {programs?.state === 'done' && (
        <>
          {programs.value.items.map((item, i) => (
            <SuggestionLine key={`${item.field}-${i}`} suggestion={item} fields={fields} onInsert={onInsert} />
          ))}
          {programs.value.items.length === 0 && <SupportText>그날 이 어르신이 참여한 프로그램이 없습니다.</SupportText>}
          {programs.value.skipped > 0 && <SupportText>‘기타’ 프로그램 {programs.value.skipped}건은 넣을 칸을 정하기 어려워 가져오지 않았습니다.</SupportText>}
        </>
      )}

      {rehab?.state === 'error' && rehab.error && <ErrorBanner message={rehab.error} onRetry={() => void importRehab()} />}
      {rehab?.state === 'done' &&
        (rehab.value ? (
          <SuggestionLine suggestion={rehab.value} fields={fields} onInsert={onInsert} />
        ) : (
          <SupportText>그날 이 어르신의 기능회복훈련 기록이 없습니다.</SupportText>
        ))}

      {events?.state === 'error' && events.error && <ErrorBanner message={events.error} onRetry={() => void importEvents()} />}
      {events?.state === 'done' &&
        (events.value ? (
          <SuggestionLine suggestion={events.value} fields={fields} onInsert={onInsert} />
        ) : (
          <SupportText>그날 이 어르신의 상태변화·사고 기록이 없습니다.</SupportText>
        ))}

      {visits?.state === 'error' && visits.error && <ErrorBanner message={visits.error} onRetry={() => void importVisits()} />}
      {visits?.state === 'done' &&
        (visits.value ? (
          <SuggestionLine suggestion={visits.value} fields={fields} onInsert={onInsert} />
        ) : (
          <SupportText>그날 이 어르신의 진료 동행 기록이 없습니다.</SupportText>
        ))}
    </VStack>
  );
}
