'use client';

/** 서류함 화면이 읽는 것 — 서류 기록과 자동 근거 셋(계약·올해 급여계획·위험도). 하나가 실패해도 나머지는 보이고, 실패한 것은 따로 알린다. */
import { useCallback, useMemo } from 'react';
import { listCarePlans, listElderContracts, listElderDocuments, listRiskLatest } from '@/lib/lab/labApi';
import type { CarePlan, ElderContract, ElderDocument, RiskLatest } from '@/lib/lab/labTypes';
import { useRecordsLoader } from './useRecordsLoader';

const NO_DOCS: ElderDocument[] = [];
const NO_CONTRACTS: ElderContract[] = [];
const NO_PLANS: CarePlan[] = [];
const NO_RISK: RiskLatest[] = [];

export function useElderDocsData(year: number) {
  const loadDocs = useCallback(() => listElderDocuments(), []);
  const loadContracts = useCallback(() => listElderContracts(), []);
  const loadPlans = useCallback(() => listCarePlans(year), [year]);
  const loadRisk = useCallback(() => listRiskLatest(), []);

  const docs = useRecordsLoader(loadDocs, '수급자 서류 목록을 불러오지 못했습니다', NO_DOCS);
  const contracts = useRecordsLoader(loadContracts, '계약 정보를 불러오지 못했습니다', NO_CONTRACTS);
  const plans = useRecordsLoader(loadPlans, '올해 급여계획을 불러오지 못했습니다', NO_PLANS);
  const risk = useRecordsLoader(loadRisk, '위험도 평가를 불러오지 못했습니다', NO_RISK);

  const isLoading = docs.isLoading || contracts.isLoading || plans.isLoading || risk.isLoading;
  const errors = [docs.error, contracts.error, plans.error, risk.error].filter((e): e is string => e !== null);

  const reloadAll = useCallback(() => {
    void docs.reload();
    void contracts.reload();
    void plans.reload();
    void risk.reload();
  }, [docs, contracts, plans, risk]);

  return useMemo(
    () => ({ docs: docs.data, contracts: contracts.data, plans: plans.data, risk: risk.data, isLoading, errors, reloadAll, reloadDocs: docs.reload }),
    // errors는 매번 새 배열이라 값 하나하나를 의존으로 둔다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs.data, contracts.data, plans.data, risk.data, isLoading, docs.error, contracts.error, plans.error, risk.error, reloadAll, docs.reload],
  );
}
