'use client';

/** 차량·보험 보기 — 차량 목록과 보험 상태 칩(insuranceStatus), 추가·고치기·삭제. 만기 30일 안이면 강조하고, 종합보험이 아니면 책임보험 경고를 띄운다. */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { deleteTransportVehicle } from '@/lib/lab/labApi';
import type { TransportVehicle } from '@/lib/lab/labTypes';
import { daysBetween } from '@/lib/lab/labDate';
import { insuranceStatus } from '@/lib/lab/transportRules';
import { Chip, LabConfirm, useNotify } from '@/components/lab/LabUi';
import { dotDate, errorText, todayString } from '@/components/lab/labFormat';
import { INSURANCE_LABEL, INSURANCE_TONE } from './TransportDraft';
import TransportVehicleForm from './TransportVehicleForm';
import styles from './labRecords.module.css';
import own from './Transport.module.css';

interface Props {
  vehicles: TransportVehicle[];
  onChanged: () => void;
}

export default function TransportVehicles({ vehicles, onChanged }: Props) {
  const notify = useNotify();
  const today = todayString();
  const [form, setForm] = useState<{ key: number; vehicle: TransportVehicle | null } | null>(null);
  const [confirm, setConfirm] = useState<TransportVehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(
    () => vehicles.map((v) => ({ v, status: insuranceStatus(v, today) })).sort((a, b) => Number(b.v.active) - Number(a.v.active) || a.v.vehicleNo.localeCompare(b.v.vehicleNo, 'ko')),
    [vehicles, today],
  );
  const warned = rows.filter((r) => r.v.active && (r.status === 'EXPIRED' || r.status === 'EXPIRING' || r.status === 'NOT_COMPREHENSIVE'));
  const notComprehensive = rows.filter((r) => r.v.active && !r.v.comprehensive);

  const remove = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await deleteTransportVehicle(confirm.id);
      notify('차량을 삭제했습니다', 'success');
      setConfirm(null);
      onChanged();
    } catch (e) {
      notify(errorText(e, '차량을 삭제하지 못했습니다'), 'error');
    } finally {
      setDeleting(false);
    }
  };
  const open = (vehicle: TransportVehicle | null) => setForm((f) => ({ key: (f?.key ?? 0) + 1, vehicle }));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <details className={`${own.guide} ${own.guideInline}`}>
          <summary>차량 보험·점검 안내</summary>
          <p>이동서비스 차량은 자동차종합보험에 가입해야 하며, 책임보험만으로는 인정되지 않습니다. 보험 만기가 30일 안으로 다가오면 표에서 강조해 보여 드립니다.</p>
          <p>2026년판 평가 기준에서는 차량 점검 기록이 빠졌습니다. 위생·안전 점검의 차량 점검은 안전관리를 위한 기록으로 계속 쓰시면 됩니다.</p>
        </details>
        <div className={styles.spacer}>
          <span className={styles.chips}>
            <Button label="차량 추가" variant="primary" onClick={() => open(null)} />
          </span>
        </div>
      </div>

      {notComprehensive.length > 0 && (
        <div className={own.dangerBox}>
          <Text type="label">책임보험만으로는 인정되지 않습니다</Text>
          <Text type="supporting">종합보험이 아닌 차량: {notComprehensive.map((r) => r.v.vehicleNo).join(', ')}. 자동차종합보험으로 가입하거나 가입 여부를 다시 확인해 주세요.</Text>
        </div>
      )}
      {warned.some((r) => r.status === 'EXPIRING' || r.status === 'EXPIRED') && (
        <div className={own.noticeBox}>
          <Text type="supporting">보험 만기가 지났거나 30일 안인 차량이 있습니다. 갱신 뒤 보험 기간을 고쳐 주세요.</Text>
        </div>
      )}

      {form && <TransportVehicleForm key={form.key} vehicle={form.vehicle} vehicles={vehicles} onSaved={onChanged} onClose={() => setForm(null)} />}

      {rows.length === 0 ? (
        <Card padding={6}>
          <EmptyState isCompact title="등록된 차량이 없습니다" description="차량 추가로 송영 차량과 보험 기간을 등록하면 만기를 미리 알려 드립니다." />
        </Card>
      ) : (
        <Card padding={0}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyName}>차량 번호</th>
                  <th>차종</th>
                  <th>보험 상태</th>
                  <th>종합보험</th>
                  <th>보험사</th>
                  <th>보험 기간</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ v, status }) => {
                  const left = v.insuranceTo ? daysBetween(today, v.insuranceTo.slice(0, 10)) : null;
                  const rowClass = !v.active ? '' : status === 'EXPIRED' || status === 'NOT_COMPREHENSIVE' ? own.rowDanger : status === 'EXPIRING' ? own.rowWarn : '';
                  return (
                    <tr key={v.id} className={rowClass}>
                      <td className={styles.stickyName}>
                        <Text type="label">{v.vehicleNo}</Text>
                      </td>
                      <td>{v.label ?? '-'}</td>
                      <td>
                        <span className={own.chipRow}>
                          {v.active ? (
                            <Chip tone={INSURANCE_TONE[status]} label={status === 'EXPIRING' && left !== null ? `${INSURANCE_LABEL[status]} (${left === 0 ? '오늘' : `D-${left}`})` : INSURANCE_LABEL[status]} />
                          ) : (
                            <Chip tone="neutral" label="운행 안 함" />
                          )}
                        </span>
                      </td>
                      <td>{v.comprehensive ? '가입' : '책임보험만'}</td>
                      <td>{v.insurer ?? '-'}</td>
                      <td>{v.insuranceFrom && v.insuranceTo ? `${dotDate(v.insuranceFrom)} ~ ${dotDate(v.insuranceTo)}` : '-'}</td>
                      <td>
                        <span className={styles.chips}>
                          <Button label="고치기" variant="ghost" size="sm" onClick={() => open(v)} />
                          <Button label="삭제" variant="ghost" size="sm" onClick={() => setConfirm(v)} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <LabConfirm
        isOpen={confirm !== null}
        title="이 차량을 삭제할까요?"
        description="삭제해도 이미 쓴 운행일지는 남습니다. 더 이상 운행하지 않는 차량은 삭제하는 대신 고치기에서 '지금 운행하는 차량'을 해제해 두면 기록과 함께 보관됩니다."
        actionLabel="삭제"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
