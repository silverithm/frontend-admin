'use client';

/** 대장 목록 — 종류별로 상태 칩·최근 개정일·비치 장소·교육일. 아직 없는 필수 종류는 ‘등록 전’이다. */
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import type { PolicyDoc } from '@/lib/lab/labTypes';
import { SLOTS, kindName, slotKeyOf } from './PolicyDocKinds';
import type { Slot } from './PolicyDocKinds';
import { statusView } from './PolicyDocStatus';
import styles from './labPlans10.module.css';

interface Props {
  docs: PolicyDoc[];
  today: string;
  loading: boolean;
  error: string | null;
  activeId: number | null;
  activeSlot: string | null;
  isDisabled: boolean;
  onRetry: () => void;
  onOpenDoc: (d: PolicyDoc) => void;
  onOpenSlot: (s: Slot) => void;
  onNewOther: () => void;
  onPrint: () => void;
}

function DocRow({ doc, today, active, onOpen }: { doc: PolicyDoc; today: string; active: boolean; onOpen: () => void }) {
  const v = statusView(doc, today);
  return (
    <button type="button" className={styles.listRow} data-active={active} onClick={onOpen}>
      <Text type="label">{doc.title || kindName(doc.kind, doc.guideNo)}</Text>
      <Chip tone={v.ready ? 'ok' : 'warn'} label={v.ready ? '갖춤' : '보완 필요'} />
      {v.gaps.length > 0 && <Text type="supporting" color="secondary">{v.gaps.join(' · ')}</Text>}
      <Text type="supporting" color="secondary" hasTabularNumbers>최근 개정 {doc.revisedOn ? dotDate(doc.revisedOn) : '-'}</Text>
      <Text type="supporting" color="secondary">비치 {doc.location?.trim() ? doc.location : '-'}</Text>
      <Text type="supporting" color="secondary" hasTabularNumbers>교육 {doc.trainedOn ? dotDate(doc.trainedOn) : '-'}</Text>
    </button>
  );
}

export default function PolicyDocList({ docs, today, loading, error, activeId, activeSlot, isDisabled, onRetry, onOpenDoc, onOpenSlot, onNewOther, onPrint }: Props) {
  const byKey = new Map<string, PolicyDoc>();
  for (const d of docs) if (d.kind !== 'OTHER' && !byKey.has(slotKeyOf(d))) byKey.set(slotKeyOf(d), d);
  const others = docs.filter((d) => d.kind === 'OTHER');
  // 급여제공지침 ①~⑫ 중 아직 없는 것은 한 줄의 번호 단추로 모은다(열두 줄이 대장을 다 차지하지 않게)
  const missingGuides = SLOTS.filter((s) => s.kind === 'CARE_GUIDE' && !byKey.has(s.key));
  let ready = 0;
  let partial = 0;
  let missing = 0;
  for (const s of SLOTS) {
    const d = byKey.get(s.key);
    if (!d) missing += 1;
    else if (statusView(d, today).ready) ready += 1;
    else partial += 1;
  }
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">규정·지침 대장</Text>
          {!loading && !error && (
            <>
              <Chip tone="ok" label={`갖춤 ${ready}`} />
              <Chip tone={partial > 0 ? 'warn' : 'neutral'} label={`보완 필요 ${partial}`} />
              <Chip tone={missing > 0 ? 'danger' : 'neutral'} label={`등록 전 ${missing}`} />
            </>
          )}
          <Button label="대장 인쇄" variant="secondary" isDisabled={isDisabled || loading || !!error} onClick={onPrint} />
        </HStack>
        <SupportText>‘갖춤’은 항목을 모두 확인하고 최근 개정일과 비치 장소를 적었다는 뜻입니다. 문서가 있어도 내용이 충실한지는 사람이 판단합니다.</SupportText>
        {error && <ErrorBanner message={error} onRetry={onRetry} />}
        {loading && docs.length === 0 && !error ? (
          <Loading size="section" label="규정·지침 대장을 불러오는 중..." />
        ) : (
          !error && (
            <div className={styles.listStack}>
              {SLOTS.map((s) => {
                const d = byKey.get(s.key);
                if (!d && s.kind === 'CARE_GUIDE') return null;
                return d ? (
                  <DocRow key={s.key} doc={d} today={today} active={d.id === activeId} onOpen={() => onOpenDoc(d)} />
                ) : (
                  <button key={s.key} type="button" className={styles.listRow} data-empty="true" data-active={activeSlot === s.key} onClick={() => onOpenSlot(s)}>
                    <Text type="label">{s.name}</Text>
                    <Chip tone="danger" label="등록 전" />
                    <Text type="supporting" color="secondary">눌러서 등록하기</Text>
                  </button>
                );
              })}
              {missingGuides.length > 0 && (
                <div className={styles.listRow} data-empty="true" data-static="true">
                  <Text type="label">급여제공지침</Text>
                  <Chip tone="danger" label={`등록 전 ${missingGuides.length}개`} />
                  <div className={styles.guideNos}>
                    {missingGuides.map((s) => (
                      <button key={s.key} type="button" className={styles.guideNo} data-active={activeSlot === s.key} onClick={() => onOpenSlot(s)} aria-label={`${s.name} 등록하기`} title={`${s.name} 등록하기`}>
                        {s.name.replace('급여제공지침 ', '').replace(' 개인정보보호지침', '')}
                      </button>
                    ))}
                  </div>
                  <Text type="supporting" color="secondary">번호를 눌러 등록하기 · ⑩은 개인정보보호지침</Text>
                </div>
              )}
              <Text type="label">기타 문서</Text>
              {others.length === 0 && <Text type="supporting" color="secondary">등록한 기타 문서가 없습니다.</Text>}
              {others.map((d) => (
                <DocRow key={d.id} doc={d} today={today} active={d.id === activeId} onOpen={() => onOpenDoc(d)} />
              ))}
              <HStack gap={2}>
                <Button label="기타 문서 등록" variant="secondary" isDisabled={isDisabled} onClick={onNewOther} />
              </HStack>
            </div>
          )
        )}
      </VStack>
    </Card>
  );
}
