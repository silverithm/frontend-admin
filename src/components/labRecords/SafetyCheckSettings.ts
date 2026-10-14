'use client';

/**
 * 위생·안전 점검의 운영 설정 — 휴원일과 "차량 운행 안 함"을 이 브라우저에 기억한다.
 * 키와 모양은 평가 준비 화면이 같은 값을 읽으므로 labFormat의 상수·읽기 함수를 그대로 쓴다.
 * 서버 렌더와 첫 화면이 어긋나지 않게 값은 화면이 뜬 뒤에 읽는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SAFETY_CLOSED_KEY, SAFETY_NO_VEHICLE_KEY, SAFETY_SATURDAY_KEY, operatingDaysOf, readClosedDates, readNoVehicle, readOperatesSaturday, writeStored } from '@/components/lab/labFormat';

export function useSafetySettings(month: string) {
  const [closed, setClosed] = useState<string[]>([]);
  const [noVehicle, setNoVehicleState] = useState(false);
  const [saturday, setSaturdayState] = useState(false);

  useEffect(() => {
    setClosed(readClosedDates());
    setNoVehicleState(readNoVehicle());
    setSaturdayState(readOperatesSaturday());
  }, []);

  const toggleClosed = useCallback(
    (date: string) => {
      const next = closed.includes(date) ? closed.filter((d) => d !== date) : [...closed, date].sort();
      setClosed(next);
      writeStored(SAFETY_CLOSED_KEY, JSON.stringify(next));
    },
    [closed],
  );

  const setNoVehicle = useCallback((value: boolean) => {
    setNoVehicleState(value);
    writeStored(SAFETY_NO_VEHICLE_KEY, value ? '1' : '0');
  }, []);

  const setSaturday = useCallback((value: boolean) => {
    setSaturdayState(value);
    writeStored(SAFETY_SATURDAY_KEY, value ? '1' : '0');
  }, []);

  const operatingDays = useMemo(() => operatingDaysOf(month, closed, saturday), [month, closed, saturday]);
  return { closed, noVehicle, saturday, operatingDays, toggleClosed, setNoVehicle, setSaturday };
}
