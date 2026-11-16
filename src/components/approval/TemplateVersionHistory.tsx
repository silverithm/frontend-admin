'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Text } from '@astryxdesign/core/Text';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Loading } from '@/components/Loading';
import { useConfirm } from '@/components/ConfirmDialog';
import OfficialDocument from '@/components/approval/OfficialDocument';
import { buildSampleApproval } from '@/components/approval/templatePreview';
import { getApprovalTemplateVersions, restoreApprovalTemplateVersion } from '@/lib/apiService';
import { diffVersions, parseVersionSchema, summarizeChanges } from '@/lib/templateVersionDiff';
import type { ApprovalTemplate, ApprovalTemplateVersion } from '@/types/approvalTemplate';
import type { ApproverCandidate } from '@/types/approval';

/**
 * 양식 버전 기록(2026-11-16, 구글 시트 '버전 기록'처럼).
 *
 * 숲속 업무일지에서 '행정 업무'를 복제한 뒤 원본을 지우자 지난 문서 본문이 사라져 보였다. 양식의 예전 모습이
 * 어디에도 없어 서버 로그로 거꾸로 맞춰 되살렸다. 이제 저장할 때마다 서버가 그때 모습을 남기고, 여기서
 * 날짜별로 골라 보고(무엇이 바뀌었는지 한 줄 요약 + 공문 미리보기) 그 모습으로 되돌린다.
 * 되돌려도 지금 모습은 기록에 남는다 — 되돌리기를 되돌릴 수 있다.
 */
interface Props {
  template: ApprovalTemplate;
  companyName: string;
  onClose: () => void;
  /** 되돌린 뒤 — 양식 목록을 다시 불러온다 */
  onRestored: (message: string) => void;
  onError: (message: string) => void;
}

const KIND_TEXT: Record<ApprovalTemplateVersion['kind'], string> = {
  BASELINE: '기록을 시작할 때 모습',
  CREATED: '처음 만듦',
  EDITED: '수정',
  RESTORED: '되돌림',
};

function parseLine(raw?: string | null): ApproverCandidate[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ApproverCandidate[]) : undefined;
  } catch {
    return undefined;
  }
}

const dayKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');
const dayLabel = (iso: string) => format(new Date(iso), 'M월 d일 (EEE)', { locale: ko });
const timeLabel = (iso: string) => format(new Date(iso), 'HH:mm');

export default function TemplateVersionHistory({ template, companyName, onClose, onRestored, onError }: Props) {
  const { confirm, ConfirmContainer } = useConfirm();
  const [versions, setVersions] = useState<ApprovalTemplateVersion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  /** [selectNewest] — 되돌린 뒤에는 방금 생긴 '지금 양식' 줄을 고른다 */
  const load = useCallback(async (selectNewest = false) => {
    setLoadError(null);
    try {
      const list = await getApprovalTemplateVersions(template.id);
      setVersions(list);
      setSelectedId((prev) =>
        !selectNewest && prev != null && list.some((v) => v.id === prev) ? prev : list[0]?.id ?? null,
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '버전 기록을 불러오지 못했습니다.');
      setVersions([]);
    }
  }, [template.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // 버전마다 바로 앞 버전과 비교한 변화 — 목록은 최근 것부터라 다음 칸이 앞 버전이다
  const summaries = useMemo(() => {
    const map = new Map<number, string>();
    (versions ?? []).forEach((v, i) => {
      const prev = versions?.[i + 1];
      if (v.kind === 'BASELINE') map.set(v.id, '이전 기록은 없습니다');
      else if (v.kind === 'CREATED' && !prev) map.set(v.id, '');
      else map.set(v.id, summarizeChanges(diffVersions(prev, v)) || '항목 구성은 그대로');
    });
    return map;
  }, [versions]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ApprovalTemplateVersion[] }[] = [];
    for (const v of versions ?? []) {
      const key = dayKey(v.createdAt);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(v);
      else out.push({ key, label: dayLabel(v.createdAt), items: [v] });
    }
    return out;
  }, [versions]);

  const selected = versions?.find((v) => v.id === selectedId) ?? null;

  /** 되돌린 버전이면 '9월 14일 08:20 모습으로 되돌림' — 버전 번호 대신 사람이 고른 시각으로 말한다 */
  const restoredText = (v: ApprovalTemplateVersion) => {
    const source = v.restoredFromNo != null ? versions?.find((x) => x.versionNo === v.restoredFromNo) : undefined;
    return source ? `${dayLabel(source.createdAt)} ${timeLabel(source.createdAt)} 모습으로 되돌림` : '예전 모습으로 되돌림';
  };
  const whoText = (v: ApprovalTemplateVersion) => {
    if (v.kind === 'BASELINE') return KIND_TEXT.BASELINE;
    const who = v.savedByName?.trim() || '저장한 사람 모름';
    if (v.kind === 'CREATED') return `${who} · 처음 만듦`;
    if (v.kind === 'RESTORED') return `${who} · ${restoredText(v)}`;
    return who;
  };
  const selectedIndex = versions && selected ? versions.indexOf(selected) : -1;
  const selectedChanges = selected && versions ? diffVersions(versions[selectedIndex + 1], selected) : [];
  const selectedSchema = selected ? parseVersionSchema(selected.formSchema) : null;

  const handleRestore = async () => {
    if (!selected || selected.current) return;
    const when = `${dayLabel(selected.createdAt)} ${timeLabel(selected.createdAt)}`;
    const ok = await confirm({
      title: `${when} 모습으로 되돌릴까요?`,
      message:
        '양식의 이름·항목 구성·기본 결재선이 이 버전으로 바뀝니다. 지금 모습도 버전 기록에 남아 있어 언제든 다시 돌아올 수 있습니다. 열람 대상과 사용 여부는 그대로입니다.',
      confirmText: '되돌리기',
      cancelText: '취소',
      type: 'warning',
    });
    if (!ok) return;
    setIsRestoring(true);
    try {
      await restoreApprovalTemplateVersion(template.id, selected.id);
      await load(true);
      onRestored(`양식을 ${when} 모습으로 되돌렸습니다.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : '양식을 되돌리지 못했습니다.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} purpose="info" width={1120} maxHeight="95vh">
        <Layout
          header={<DialogHeader title={`${template.name} 버전 기록`} onOpenChange={(open) => { if (!open) onClose(); }} />}
          content={
            <LayoutContent>
              {versions === null ? (
                <div style={{ padding: 'var(--spacing-10)' }}><Loading /></div>
              ) : loadError ? (
                <VStack gap={2} hAlign="center">
                  <Text color="secondary">{loadError}</Text>
                  <Button label="다시 불러오기" variant="secondary" size="sm" onClick={() => void load()} />
                </VStack>
              ) : versions.length === 0 ? (
                <Text color="secondary">아직 남은 버전이 없습니다. 양식을 저장하면 그때부터 버전이 남습니다.</Text>
              ) : (
                <div className="carev-tver">
                  {/* 왼쪽 — 날짜별 버전 목록 */}
                  <nav aria-label="버전 목록" className="carev-tver-list">
                    {groups.map((group) => (
                      <section key={group.key}>
                        <h3 className="carev-tver-day">{group.label}</h3>
                        <ul>
                          {group.items.map((v) => {
                            const isSelected = v.id === selectedId;
                            const summary = summaries.get(v.id);
                            return (
                              <li key={v.id}>
                                <button
                                  type="button"
                                  className="carev-tver-item"
                                  aria-current={isSelected ? 'true' : undefined}
                                  onClick={() => setSelectedId(v.id)}
                                >
                                  <span className="carev-tver-item-top">
                                    <span className="carev-tver-time">{timeLabel(v.createdAt)}</span>
                                    {v.current ? <Badge variant="teal" label="지금 양식" /> : null}
                                    {v.kind === 'RESTORED' && v.restoredFromNo ? (
                                      <Badge variant="neutral" label="되돌림" />
                                    ) : null}
                                  </span>
                                  <span className="carev-tver-who">{whoText(v)}</span>
                                  {summary ? <span className="carev-tver-summary">{summary}</span> : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                    <p className="carev-tver-note">
                      저장할 때마다 자동으로 남습니다. 열람 대상·사용 여부는 버전에 들어가지 않습니다.
                    </p>
                  </nav>

                  {/* 오른쪽 — 고른 버전 */}
                  <div className="carev-tver-detail">
                    {selected ? (
                      <VStack gap={3}>
                        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
                          <VStack gap={0}>
                            <Text type="label" weight="semibold">
                              {dayLabel(selected.createdAt)} {timeLabel(selected.createdAt)}
                              {selected.name !== template.name ? ` · ${selected.name}` : ''}
                            </Text>
                            <Text type="supporting" color="secondary">
                              {selected.kind === 'BASELINE'
                                ? '버전 기록을 시작할 때 있던 모습입니다'
                                : selected.kind === 'EDITED'
                                  ? `${whoText(selected)} · ${KIND_TEXT.EDITED}`
                                  : whoText(selected)}
                            </Text>
                          </VStack>
                          <Button
                            label={selected.current ? '지금 양식입니다' : '이 버전으로 되돌리기'}
                            variant="primary"
                            size="sm"
                            isDisabled={selected.current}
                            isLoading={isRestoring}
                            onClick={() => void handleRestore()}
                          />
                        </HStack>

                        {selectedChanges.length > 0 ? (
                          <ul className="carev-tver-changes" aria-label="바로 앞 버전과 달라진 점">
                            {selectedChanges.map((c) => (
                              <li key={c.kind}>
                                <span className="carev-tver-change-kind" data-kind={c.kind}>{c.kind}</span>
                                {c.items.length > 0 ? <span>{c.items.join(', ')}</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="carev-tver-preview">
                          {selectedSchema?.fields?.length ? (
                            <OfficialDocument
                              approval={buildSampleApproval(selectedSchema, selected.name, parseLine(selected.defaultApprovalLine))}
                              schema={selectedSchema}
                              companyName={companyName}
                              showPrintButton={false}
                            />
                          ) : (
                            <Text color="secondary">
                              {selected.fileName ? `파일 양식 — ${selected.fileName}` : '이 버전에는 서식 항목이 없습니다.'}
                            </Text>
                          )}
                        </div>
                      </VStack>
                    ) : null}
                  </div>
                </div>
              )}
            </LayoutContent>
          }
        />
      </Dialog>
      <ConfirmContainer />
      <style>{`
        .carev-tver { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: var(--spacing-5); min-height: 60vh; }
        .carev-tver-list { border-right: 1px solid var(--color-border); padding-right: var(--spacing-3); max-height: 72vh; overflow-y: auto; }
        .carev-tver-list ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
        .carev-tver-day { margin: var(--spacing-3) 0 var(--spacing-1); padding: 0 var(--spacing-2); font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
        .carev-tver-list section:first-child .carev-tver-day { margin-top: 0; }
        .carev-tver-item { all: unset; box-sizing: border-box; display: grid; gap: 2px; width: 100%; padding: 10px 12px; border-radius: var(--radius-inner); cursor: pointer; }
        .carev-tver-item:hover { background: var(--color-background-muted); }
        .carev-tver-item:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
        .carev-tver-item[aria-current='true'] { background: var(--color-background-muted); }
        .carev-tver-item-top { display: flex; align-items: center; gap: 6px; }
        .carev-tver-time { font-size: 15px; font-weight: 600; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
        .carev-tver-who { font-size: 13px; color: var(--color-text-secondary); }
        .carev-tver-summary { font-size: 12px; line-height: 1.45; color: var(--color-text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .carev-tver-note { margin: var(--spacing-4) var(--spacing-2) 0; font-size: 12px; line-height: 1.5; color: var(--color-text-secondary); }
        .carev-tver-detail { min-width: 0; }
        .carev-tver-changes { list-style: none; margin: 0; padding: var(--spacing-3); display: grid; gap: 6px; border-radius: var(--radius-inner); background: var(--color-background-muted); font-size: 13px; color: var(--color-text-primary); }
        .carev-tver-changes li { display: flex; gap: 8px; align-items: baseline; }
        .carev-tver-change-kind { flex-shrink: 0; min-width: 56px; font-weight: 600; color: var(--color-text-secondary); }
        .carev-tver-change-kind[data-kind='삭제'] { color: var(--color-text-red); }
        .carev-tver-preview { background: var(--color-background-muted); padding: var(--spacing-4); border-radius: var(--radius-inner); overflow-x: auto; }
        @media (max-width: 760px) {
          .carev-tver { grid-template-columns: 1fr; }
          .carev-tver-list { border-right: 0; padding-right: 0; max-height: 40vh; border-bottom: 1px solid var(--color-border); padding-bottom: var(--spacing-3); }
        }
      `}</style>
    </>
  );
}
