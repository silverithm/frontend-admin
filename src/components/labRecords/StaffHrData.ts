'use client';

/** 직원 인사 화면이 읽는 네 가지 목록 — 직원·인사 기준·이수/검진 기록·급여 기준. 각각 따로 로딩·오류를 가진다. */
import { useCallback } from 'react';
import { listLabStaff, listPayrollProfiles, listStaffCerts, listStaffProfiles } from '@/lib/lab/labApi';
import type { LabStaff, PayrollProfile, StaffCert, StaffProfile } from '@/lib/lab/labTypes';
import { useRecordsLoader } from './useRecordsLoader';

const NONE_STAFF: LabStaff[] = [];
const NONE_PROFILES: StaffProfile[] = [];
const NONE_CERTS: StaffCert[] = [];
const NONE_PAY: PayrollProfile[] = [];

export function useStaffHrData() {
  const loadStaff = useCallback(() => listLabStaff(), []);
  const loadProfiles = useCallback(() => listStaffProfiles(), []);
  const loadCerts = useCallback(() => listStaffCerts(), []);
  const loadPay = useCallback(() => listPayrollProfiles(), []);
  const staff = useRecordsLoader(loadStaff, '직원 목록을 불러오지 못했습니다', NONE_STAFF);
  const profiles = useRecordsLoader(loadProfiles, '직원 인사 기준을 불러오지 못했습니다', NONE_PROFILES);
  const certs = useRecordsLoader(loadCerts, '이수·검진 기록을 불러오지 못했습니다', NONE_CERTS);
  const pay = useRecordsLoader(loadPay, '급여 기준을 불러오지 못했습니다', NONE_PAY);
  return { staff, profiles, certs, pay };
}
