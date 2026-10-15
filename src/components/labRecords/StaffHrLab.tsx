'use client';

/**
 * 직원 인사 — 경력직(근속·경력직 비율), 보수교육(이수 시간·이수율), 건강검진(검진 기한·검진률) 세 보기.
 * 위쪽에서 직원 기준(입사일·직종·출생연도·자격 합격일·사무직 여부)을 편집하고, 이수·검진 기록을 추가·고친다. 직원별 현황표는 A4로 인쇄한다.
 * 점수는 모두 "지금 기준 추정"이다 — 평가 4·5는 공단 전산이 정본이다.
 */
import { useMemo, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Loading } from '@/components/Loading';
import type { StaffCert, StaffCertKind } from '@/lib/lab/labTypes';
import { isValidYmd } from '@/lib/lab/labDate';
import { ErrorBanner } from '@/components/lab/LabUi';
import { readStored, todayString } from '@/components/lab/labFormat';
import { useStaffHrData } from './StaffHrData';
import { OPENED_ON_KEY, buildPeople } from './StaffHrDraft';
import StaffHrCertForm from './StaffHrCertForm';
import StaffHrEdu from './StaffHrEdu';
import StaffHrExperienced from './StaffHrExperienced';
import StaffHrHealth from './StaffHrHealth';
import StaffHrProfileEditor from './StaffHrProfileEditor';
import StaffHrSheet from './StaffHrSheet';
import styles from './labRecords.module.css';

type View = 'EXPERIENCED' | 'EDU' | 'HEALTH';
type CertForm = { kind: StaffCertKind; cert: StaffCert | null; memberId: number | null };

export default function StaffHrLab() {
  const { staff, profiles, certs, pay } = useStaffHrData();
  const [view, setView] = useState<View>('EXPERIENCED');
  const [profileEdit, setProfileEdit] = useState<{ memberId: number | null } | null>(null);
  const [certForm, setCertForm] = useState<CertForm | null>(null);
  const [printing, setPrinting] = useState(false);
  const today = todayString();

  const people = useMemo(() => buildPeople(staff.data, profiles.data), [staff.data, profiles.data]);
  const loading = staff.isLoading || profiles.isLoading || certs.isLoading;
  // 저장 뒤 다시 불러오는 동안에도 보기를 그대로 두어 연도 같은 선택이 사라지지 않게 한다
  const loaded = !staff.error && !profiles.error && !certs.error && !(loading && people.length === 0);
  const openedOn = (() => {
    const raw = readStored(OPENED_ON_KEY);
    return raw && isValidYmd(raw) ? raw : '';
  })();

  const certKind: StaffCertKind | null = view === 'EDU' ? 'CONTINUING_EDU' : view === 'HEALTH' ? 'HEALTH_CHECK' : null;
  const viewProps = {
    people,
    certs: certs.data,
    today,
    onEditProfile: (memberId: number) => {
      setCertForm(null);
      setProfileEdit({ memberId });
    },
    onAddCert: (memberId: number | null) => {
      if (certKind === null) return;
      setProfileEdit(null);
      setCertForm({ kind: certKind, cert: null, memberId });
    },
    onEditCert: (cert: StaffCert) => {
      setProfileEdit(null);
      setCertForm({ kind: cert.kind, cert, memberId: cert.memberId });
    },
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <SegmentedControl label="보기" value={view} onChange={(v) => { setView(v as View); setCertForm(null); }}>
          <SegmentedControlItem value="EXPERIENCED" label="경력직" />
          <SegmentedControlItem value="EDU" label="보수교육" />
          <SegmentedControlItem value="HEALTH" label="건강검진" />
        </SegmentedControl>
        <div className={styles.spacer}>
          <span className={styles.chips}>
            <Button label="직원 기준 편집" variant="secondary" isDisabled={!loaded} onClick={() => { setCertForm(null); setProfileEdit({ memberId: null }); }} />
            <Button label="현황표 인쇄" variant="secondary" isDisabled={!loaded} onClick={() => setPrinting(true)} />
          </span>
        </div>
      </div>

      {staff.error && <ErrorBanner message={staff.error} onRetry={() => void staff.reload()} />}
      {profiles.error && <ErrorBanner message={profiles.error} onRetry={() => void profiles.reload()} />}
      {certs.error && <ErrorBanner message={certs.error} onRetry={() => void certs.reload()} />}
      {pay.error && <ErrorBanner message={`${pay.error} (급여 기준에서 가져오기만 막힙니다)`} onRetry={() => void pay.reload()} />}

      {profileEdit && (
        <StaffHrProfileEditor
          key={profileEdit.memberId ?? 'blank'}
          people={people}
          payroll={pay.data}
          memberId={profileEdit.memberId}
          onSaved={() => void profiles.reload()}
          onClose={() => setProfileEdit(null)}
        />
      )}
      {certForm && (
        <StaffHrCertForm
          key={certForm.cert?.id ?? `new-${certForm.kind}-${certForm.memberId ?? 'any'}`}
          kind={certForm.kind}
          people={people}
          cert={certForm.cert}
          memberId={certForm.memberId}
          defaultDate={today}
          onSaved={() => void certs.reload()}
          onClose={() => setCertForm(null)}
        />
      )}

      {loading && people.length === 0 ? (
        <Loading size="inline" label="직원 인사 정보를 불러오는 중..." />
      ) : loaded ? (
        view === 'EXPERIENCED' ? (
          <StaffHrExperienced {...viewProps} />
        ) : view === 'EDU' ? (
          <StaffHrEdu {...viewProps} />
        ) : (
          <StaffHrHealth {...viewProps} />
        )
      ) : null}

      {printing && <StaffHrSheet people={people} certs={certs.data} today={today} openedOn={openedOn} onDone={() => setPrinting(false)} />}
    </div>
  );
}
