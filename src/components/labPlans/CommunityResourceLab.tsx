'use client';

/**
 * 자원 연계 — 해를 고르고 외부기관·지역자원 연계를 적는다. 그 해 연계를 한 번에 받아(listResourceLinks year) 목록과 요약을 같은 자료로 낸다.
 * 어르신 욕구 메모는 자원의 종류와 찾는 방법만 제안받는다(AI).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import { ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { defaultPersonName, errorText, todayString } from '@/components/lab/labFormat';
import { useLabElders } from '@/components/lab/useLabElders';
import { YearStepper } from '@/components/labRecords/RecordsUi';
import { dedupeById, useAlive } from '@/components/labRecords/recordsFormat';
import { resourceSummary } from '@/lib/lab/communityRules';
import { createResourceLink, deleteResourceLink, listResourceLinks, updateResourceLink } from '@/lib/lab/labApi';
import type { ResourceLink, ResourceType } from '@/lib/lab/labTypes';
import CommunityResourceAi from './CommunityResourceAi';
import { draftOfResource, emptyResourceDraft, inputOfResourceDraft, resourceIssues } from './CommunityResourceDraft';
import type { ResourceDraft } from './CommunityResourceDraft';
import CommunityResourceForm from './CommunityResourceForm';
import CommunityResourceList from './CommunityResourceList';
import CommunityResourceSummary from './CommunityResourceSummary';
import styles from './labPlans.module.css';

export default function CommunityResourceLab() {
  const alive = useAlive();
  const notify = useNotify();
  const today = todayString();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { elders, isLoading: eldersLoading, error: eldersError } = useLabElders();
  const [links, setLinks] = useState<ResourceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResourceDraft>(() => emptyResourceDraft(todayString(), defaultPersonName()));
  const [fallbackName, setFallbackName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ResourceLink | null>(null);
  const [deleting, setDeleting] = useState(false);
  const seq = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listResourceLinks({ year });
      if (!alive.current || n !== seq.current) return; // 늦게 온 응답은 버린다
      setLinks(dedupeById(list));
    } catch (err) {
      if (!alive.current || n !== seq.current) return;
      setLinks([]);
      setError(errorText(err, '자원연계 기록을 불러오지 못했습니다'));
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [year, alive]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const changeYear = (y: number) => {
    setYear(y);
    setDraft((d) => (d.id === null ? { ...d, linkedOn: y === thisYear ? today : `${y}-12-31` } : d));
  };

  const sorted = useMemo(() => [...links].sort((a, b) => (a.linkedOn < b.linkedOn ? 1 : a.linkedOn > b.linkedOn ? -1 : b.id - a.id)), [links]);
  const summary = useMemo(() => resourceSummary(links, year, today), [links, year, today]);
  const dueIds = useMemo(() => new Set(summary.followUpsDue.map((l) => l.id)), [summary]);

  const save = async () => {
    if (savingRef.current) return;
    const issues = resourceIssues(draft);
    if (issues.length > 0) {
      setSaveError(issues[0]);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = inputOfResourceDraft(draft);
      const saved = draft.id === null ? await createResourceLink(input) : await updateResourceLink(draft.id, input);
      if (!alive.current) return;
      setLinks((cur) => {
        const rest = cur.filter((x) => x.id !== saved.id);
        return saved.linkedOn.startsWith(`${year}-`) ? [...rest, saved] : rest;
      });
      notify(draft.id === null ? '자원연계를 기록했습니다' : '자원연계를 고쳤습니다', 'success');
      setDraft(emptyResourceDraft(draft.linkedOn, draft.writer));
      setFallbackName(null);
    } catch (err) {
      if (alive.current) setSaveError(errorText(err, '자원연계를 기록하지 못했습니다'));
    } finally {
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteResourceLink(toDelete.id);
      if (!alive.current) return;
      const id = toDelete.id;
      setLinks((cur) => cur.filter((x) => x.id !== id));
      setDraft((d) => (d.id === id ? emptyResourceDraft(d.linkedOn, d.writer) : d));
      notify('자원연계 기록을 삭제했습니다', 'success');
      setToDelete(null);
    } catch (err) {
      if (alive.current) {
        notify(errorText(err, '자원연계 기록을 삭제하지 못했습니다'), 'error');
        setToDelete(null);
      }
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const useSuggestedType = (type: ResourceType) => setDraft((d) => ({ ...d, resourceType: type, aiAssisted: true }));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <YearStepper value={year} onChange={changeYear} max={thisYear} isDisabled={saving} />
      </div>

      <CommunityResourceAi onUse={useSuggestedType} />

      {eldersError && <ErrorBanner message={eldersError} />}
      <CommunityResourceForm
        draft={draft}
        onChange={setDraft}
        elders={elders}
        eldersLoading={eldersLoading}
        fallbackElderName={fallbackName}
        saving={saving}
        error={saveError}
        onSave={() => void save()}
        onCancel={() => {
          setDraft(emptyResourceDraft(draft.linkedOn, draft.writer));
          setFallbackName(null);
          setSaveError(null);
        }}
      />

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {!loading || links.length > 0 ? <CommunityResourceSummary year={year} summary={summary} /> : null}

      <Card padding={4}>
        <VStack gap={2}>
          <Text type="label">{year}년 자원연계 ({sorted.length}건)</Text>
          {loading && links.length === 0 ? (
            <Loading size="section" label="자원연계 기록을 불러오는 중..." />
          ) : (
            <CommunityResourceList
              links={sorted}
              dueIds={dueIds}
              isBusy={saving || deleting}
              onEdit={(l) => {
                setDraft(draftOfResource(l));
                setFallbackName(l.elderlyName);
                setSaveError(null);
              }}
              onDelete={setToDelete}
            />
          )}
        </VStack>
      </Card>

      <LabConfirm
        isOpen={toDelete !== null}
        title="이 자원연계 기록을 삭제할까요?"
        description={toDelete ? `${toDelete.linkedOn} ${toDelete.institution} — 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
