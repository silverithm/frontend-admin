'use client';

/** 약품 관리 — 약품 대장(사용기한 지남·임박 강조)과 분기 점검(잠금·약품별 확인·조치, 점검표 인쇄). 두 곳이 같은 대장을 쓴다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listMedicineChecks, listMedicineStock } from '@/lib/lab/labApi';
import type { MedicineCheck, MedicineStock } from '@/lib/lab/labTypes';
import { errorText, todayString } from '@/components/lab/labFormat';
import MedicationChecks from './MedicationChecks';
import MedicationStockLedger from './MedicationStockLedger';
import styles from './labRecords.module.css';

export default function MedicationStorage() {
  const [stock, setStock] = useState<MedicineStock[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [year, setYear] = useState(() => Number(todayString().slice(0, 4)));
  const [checks, setChecks] = useState<MedicineCheck[]>([]);
  const [checksLoading, setChecksLoading] = useState(true);
  const [checksError, setChecksError] = useState<string | null>(null);
  const stockSeq = useRef(0);
  const checkSeq = useRef(0);

  const loadStock = useCallback(async () => {
    const n = ++stockSeq.current;
    setStockLoading(true);
    setStockError(null);
    try {
      const list = await listMedicineStock(true);
      if (n === stockSeq.current) setStock(list);
    } catch (e) {
      if (n === stockSeq.current) {
        setStock([]);
        setStockError(errorText(e, '약품 대장을 불러오지 못했습니다'));
      }
    } finally {
      if (n === stockSeq.current) setStockLoading(false);
    }
  }, []);

  const loadChecks = useCallback(async (target: number) => {
    const n = ++checkSeq.current;
    setChecksLoading(true);
    setChecksError(null);
    try {
      const list = await listMedicineChecks(target);
      if (n === checkSeq.current) setChecks(list);
    } catch (e) {
      if (n === checkSeq.current) {
        setChecks([]);
        setChecksError(errorText(e, '약품 보관 점검을 불러오지 못했습니다'));
      }
    } finally {
      if (n === checkSeq.current) setChecksLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStock();
    return () => {
      stockSeq.current += 1;
    };
  }, [loadStock]);

  useEffect(() => {
    void loadChecks(year);
    return () => {
      checkSeq.current += 1;
    };
  }, [year, loadChecks]);

  return (
    <div className={styles.stack}>
      <MedicationChecks
        stock={stock}
        checks={checks}
        year={year}
        onYearChange={setYear}
        loading={checksLoading || stockLoading}
        error={checksError}
        onReload={() => void loadChecks(year)}
        onSaved={() => {
          void loadStock();
          void loadChecks(year);
        }}
      />
      <MedicationStockLedger stock={stock} loading={stockLoading} error={stockError} onReload={() => void loadStock()} />
    </div>
  );
}
