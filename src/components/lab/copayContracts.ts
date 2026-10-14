'use client';

/**
 * 본인부담금 "계약 정보로 채우기"가 쓰는 진행 중 계약 목록 — 화면에서 한 번만 불러온다.
 * 같은 어르신의 진행 중 계약이 둘이면 계약 시작일이 늦은 쪽을 쓴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listElderContracts } from '@/lib/lab/labApi';
import { COPAY_CLASSES, gradeLabel } from '@/lib/ltc2026';
import type { ElderContract } from '@/lib/lab/labTypes';
import type { CopayDraft } from './copayDraft';
import { errorText } from './labFormat';

export interface CopayContractsState {
  /** 어르신 번호 → 진행 중 계약. 아직 불러오는 중이거나 실패하면 null */
  byElder: Map<number, ElderContract> | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useCopayContracts(): CopayContractsState {
  const [contracts, setContracts] = useState<ElderContract[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(() => {
    const n = ++seq.current;
    setIsLoading(true);
    setError(null);
    listElderContracts({ status: 'ACTIVE' })
      .then((list) => {
        if (n === seq.current) setContracts(list);
      })
      .catch((e: unknown) => {
        if (n === seq.current) setError(errorText(e, '계약 정보를 불러오지 못했습니다'));
      })
      .finally(() => {
        if (n === seq.current) setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);

  const byElder = useMemo(() => {
    if (contracts === null) return null;
    const map = new Map<number, ElderContract>();
    for (const c of contracts) {
      const prev = map.get(c.elderlyId);
      if (!prev || c.contractStart > prev.contractStart) map.set(c.elderlyId, c);
    }
    return map;
  }, [contracts]);

  return { byElder, isLoading, error, reload };
}

export const copayClassLabel = (id: string): string => COPAY_CLASSES.find((c) => c.id === id)?.label ?? id;

/** 계약 정보로 채우면 청구서 초안에서 바뀌는 칸 — 값이 같으면 빠진다. 등급이 비어 있던 칸은 '없음'으로 보여 준다. */
export function contractFillChanges(draft: CopayDraft, contract: Pick<ElderContract, 'careGrade' | 'copayClass'>): Array<{ field: string; from: string; to: string }> {
  const out: Array<{ field: string; from: string; to: string }> = [];
  if (draft.grade !== contract.careGrade) out.push({ field: '등급', from: draft.grade === '' ? '없음' : gradeLabel(draft.grade), to: gradeLabel(contract.careGrade) });
  if (draft.copayClass !== contract.copayClass) out.push({ field: '감경 구분', from: copayClassLabel(draft.copayClass), to: copayClassLabel(contract.copayClass) });
  return out;
}

/** 계약의 등급과 감경 구분을 청구서 초안에 덮어쓴다 */
export function applyContractFill(draft: CopayDraft, contract: Pick<ElderContract, 'careGrade' | 'copayClass'>): CopayDraft {
  return { ...draft, grade: contract.careGrade, copayClass: contract.copayClass };
}
