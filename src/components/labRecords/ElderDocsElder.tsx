'use client';

/** 어르신 한 분을 열었을 때 — 서류별 줄(상태·제목·발급일·만료일·보관 위치·확인일)과 기록 추가·고치기·삭제, 점검표 인쇄. */
import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { REQUIRED_DOCS } from '@/lib/lab/elderDocRules';
import type { ElderDocStatusRow } from '@/lib/lab/elderDocRules';
import { deleteElderDocument } from '@/lib/lab/labApi';
import type { ElderDocType, ElderDocument } from '@/lib/lab/labTypes';
import { Chip, ErrorBanner, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText } from '@/components/lab/labFormat';
import ElderDocsEditor from './ElderDocsEditor';
import { expiryState, expiryText } from './ElderDocsDraft';
import { AUTO_LABEL, STATUS_LABEL } from './ElderDocsStatus';
import { useAlive } from './recordsFormat';
import styles from './labRecords.module.css';
import own from './ElderDocs.module.css';

interface Props {
  elderId: number;
  elderName: string;
  rows: Array<ElderDocStatusRow<ElderDocument>>;
  docs: ElderDocument[];
  today: string;
  onChanged: () => void;
  onPrint: () => void;
}

type Editing = { docType: ElderDocType; doc: ElderDocument | null };

const TONE = { OK: 'ok', AUTO: 'info', EXPIRED: 'danger', MISSING: 'danger' } as const;

export default function ElderDocsElder({ elderId, elderName, rows, docs, today, onChanged, onPrint }: Props) {
  const notify = useNotify();
  const alive = useAlive();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<ElderDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!removing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteElderDocument(removing.id);
      notify('서류 기록을 삭제했습니다', 'success');
      onChanged();
    } catch (e) {
      if (alive.current) setError(errorText(e, '서류 기록을 삭제하지 못했습니다'));
    } finally {
      if (alive.current) {
        setBusy(false);
        setRemoving(null);
      }
    }
  };

  const recordsOf = (docType: string) => docs.filter((d) => d.docType === docType).sort((a, b) => (b.expiresOn ?? '9999-12-31').localeCompare(a.expiresOn ?? '9999-12-31') || b.id - a.id);

  const recordLine = (d: ElderDocument) => {
    const state = expiryState(d.expiresOn, today);
    return (
      <div className={own.docRecord} key={d.id}>
        <span className={own.docRecordText}>
          <Text type="supporting">
            <strong>{d.title}</strong>
          </Text>
          <Text type="supporting" color="secondary">
            발급 {dotDate(d.issuedOn)} · 만료 {dotDate(d.expiresOn)} · 보관 {d.location || '-'} · 확인 {dotDate(d.checkedOn)}
          </Text>
          {state && <Chip tone={state.kind === 'EXPIRED' ? 'danger' : 'warn'} label={expiryText(state)} />}
          {d.note && (
            <Text type="supporting" color="secondary">
              메모: {d.note}
            </Text>
          )}
        </span>
        <span className={styles.chips}>
          <Button label="고치기" variant="ghost" onClick={() => setEditing({ docType: d.docType, doc: d })} />
          <Button label="삭제" variant="ghost" onClick={() => setRemoving(d)} />
        </span>
      </div>
    );
  };

  const editorFor = (docType: ElderDocType, doc: ElderDocument | null) =>
    editing && editing.docType === docType && editing.doc?.id === doc?.id ? (
      <ElderDocsEditor
        key={doc?.id ?? `new-${docType}`}
        elderId={elderId}
        elderName={elderName}
        docType={docType}
        doc={doc}
        onSaved={onChanged}
        onClose={() => setEditing(null)}
      />
    ) : null;

  const others = recordsOf('OTHER');

  return (
    <div className={own.detail}>
      <div className={styles.rowHead}>
        <Text type="label">{elderName} 어르신 서류</Text>
        <Button label="서류 점검표 인쇄" variant="secondary" onClick={onPrint} />
      </div>
      {error && <ErrorBanner message={error} />}
      {rows.map((r) => {
        const req = REQUIRED_DOCS.find((x) => x.docType === r.docType);
        const records = recordsOf(r.docType);
        const soon = r.status === 'OK' ? expiryState(r.doc?.expiresOn, today) : null;
        const cls = `${own.docBlock} ${r.status === 'EXPIRED' || r.status === 'MISSING' ? own.docBlockDanger : soon ? own.docBlockWarn : ''}`;
        return (
          <div className={cls} key={r.docType}>
            <div className={styles.rowHead}>
              <span className={styles.chips} style={{ justifyContent: 'flex-start' }}>
                <Text type="label">{r.label}</Text>
                <Chip tone={TONE[r.status]} label={r.status === 'MISSING' ? '없음 (빠짐)' : STATUS_LABEL[r.status]} />
                {soon && <Chip tone="warn" label={expiryText(soon)} />}
              </span>
              <Button label="기록 추가" variant="secondary" onClick={() => setEditing({ docType: r.docType, doc: null })} />
            </div>
            {r.status === 'AUTO' && req?.auto && (
              <Text type="supporting" color="secondary">
                {AUTO_LABEL[req.auto]}. 사본을 따로 보관한다면 기록을 추가해 위치를 남겨 두세요.
              </Text>
            )}
            {r.status === 'MISSING' && (
              <Text type="supporting" color="secondary">
                서류 기록도, 대신할 다른 기록도 없습니다.
              </Text>
            )}
            {r.status === 'EXPIRED' && (
              <Text type="supporting" color="secondary">
                기록한 서류가 모두 만료됐습니다. 새로 발급받아 기록을 추가해 주세요.
              </Text>
            )}
            {records.map(recordLine)}
            {records.map((d) => editorFor(r.docType, d))}
            {editorFor(r.docType, null)}
          </div>
        );
      })}
      <div className={own.docBlock}>
        <div className={styles.rowHead}>
          <Text type="label">기타 서류</Text>
          <Button label="기록 추가" variant="secondary" onClick={() => setEditing({ docType: 'OTHER', doc: null })} />
        </div>
        {others.length === 0 && (
          <Text type="supporting" color="secondary">
            기타 서류 기록이 없습니다.
          </Text>
        )}
        {others.map(recordLine)}
        {others.map((d) => editorFor('OTHER', d))}
        {editorFor('OTHER', null)}
      </div>
      <LabConfirm
        isOpen={removing !== null}
        title="이 서류 기록을 삭제할까요?"
        description={removing ? `‘${removing.title}’ 기록만 지워집니다. 실제 서류는 그대로입니다. 삭제하면 되돌릴 수 없습니다.` : ''}
        actionLabel="삭제"
        isLoading={busy}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
