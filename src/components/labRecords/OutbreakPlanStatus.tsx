'use client';

/** 감염병 대응계획 문서 상태 — 규정·지침 대장의 INFECTION_PLAN(두 체계 체크·개정일)과 올해 감염 교육 건수. 읽기 전용. */
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Loading } from '@/components/Loading';
import type { PolicyDoc, StaffTraining } from '@/lib/lab/labTypes';
import { POLICY_ITEMS, docStatus } from '@/lib/lab/policyDocRules';
import { Chip, ErrorBanner, SupportText } from '@/components/lab/LabUi';
import { dotDate, todayString } from '@/components/lab/labFormat';
import styles from './labRecords.module.css';
import own from './Outbreak.module.css';

interface Section<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

interface Props {
  docs: Section<PolicyDoc[]>;
  trainings: Section<StaffTraining[]>;
  year: number;
}

export default function OutbreakPlanStatus({ docs, trainings, year }: Props) {
  const today = todayString();
  const plans = docs.data.filter((d) => d.kind === 'INFECTION_PLAN');
  // 개정일이 가장 늦은 한 건(개정일이 없으면 뒤로)
  const plan = [...plans].sort((a, b) => (b.revisedOn ?? '').localeCompare(a.revisedOn ?? ''))[0] ?? null;
  const status = plan ? docStatus(plan, today) : null;
  const infection = trainings.data.filter((t) => t.kind === 'TRAINING' && t.category === 'INFECTION').length;

  return (
    <div className={own.box}>
      <div className={styles.stackTight}>
        <Text type="label">대응계획 문서 상태</Text>
        {docs.error && <ErrorBanner message={docs.error} onRetry={() => void docs.reload()} />}
        {docs.isLoading && plans.length === 0 ? (
          <Loading size="inline" label="규정·지침 대장을 불러오는 중..." />
        ) : docs.error ? null : plan === null || status === null ? (
          <SupportText tone="warn">등록된 감염병 대응계획이 없습니다. 규정·지침에서 먼저 등록해 주세요. (국가 위기상황 대응체계와 기관 내 환자 발생·확산 대응체계, 두 가지를 갖춰야 합니다.)</SupportText>
        ) : (
          <>
            <HStack gap={1} wrap="wrap">
              {POLICY_ITEMS.INFECTION_PLAN.map((i) => (
                <Chip key={i.key} tone={plan.checks[i.key] === true ? 'ok' : 'warn'} label={`${i.label} ${plan.checks[i.key] === true ? '있음' : '없음'}`} />
              ))}
              <Chip tone={status.revisedWithin12m ? 'ok' : 'warn'} label={plan.revisedOn ? `개정 ${dotDate(plan.revisedOn)}` : '개정일 없음'} />
            </HStack>
            {(!status.complete || !status.revisedWithin12m) && <SupportText tone="warn">{!status.complete ? '두 체계가 모두 있어야 합니다. 규정·지침에서 고쳐 주세요.' : '개정일이 12개월보다 오래됐습니다. 점검하고 개정일을 갱신해 주세요.'}</SupportText>}
          </>
        )}
        {trainings.error && <ErrorBanner message={trainings.error} onRetry={() => void trainings.reload()} />}
        {!trainings.error && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Chip tone={infection > 0 ? 'ok' : 'warn'} label={`${year}년 감염 교육 ${trainings.isLoading && trainings.data.length === 0 ? '확인 중' : `${infection}건`}`} />
            {!trainings.isLoading && infection === 0 && <SupportText>직원 교육·회의에서 ‘감염’ 교육을 기록해 주세요.</SupportText>}
          </HStack>
        )}
      </div>
    </div>
  );
}
