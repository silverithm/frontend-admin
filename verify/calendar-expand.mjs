// 일정 달력 "펼치기" — 세 화면(대시보드 월간일정, 일정 탭 월간일정, 연간일정)이
// 접어둔 내용을 한 번에 모두 펼칠 수 있는지 본다.
// 펼치기는 "제한을 푼다"와 "높이를 늘린다"가 짝이어야 한다 — 제한만 풀면 잘린 채로 겹친다.
import { WEB, read, want, done } from './_lib.mjs';

const sched = read(`${WEB}/src/components/ScheduleCalendar.tsx`);
const dash = read(`${WEB}/src/components/AdminDashboard.tsx`);
const annual = read(`${WEB}/src/components/AnnualScheduleView.tsx`);

/* ── G1: 월간일정 탭 ── */
want(/const \[isExpanded, setIsExpanded\] = useState\(false\)/.test(sched), '월간일정: isExpanded 상태가 없다');
want(/laneLimit/.test(sched) && /Number\.POSITIVE_INFINITY/.test(sched), '월간일정: 펼치면 lane 제한이 풀리지 않는다');
want(/if \(lane < laneLimit\)/.test(sched), '월간일정: lane 컷이 아직 고정 MAX_VISIBLE_LANES를 본다');
want(/laneCount:/.test(sched), '월간일정: weekBarLayouts가 laneCount를 돌려주지 않아 행 높이를 못 잰다');
want(/isExpanded \? dayVacations\.length : VACATION_MAX_VISIBLE/.test(sched), '월간일정: 펼쳐도 휴무자가 +N으로 접힌다');
want(/isExpanded \? '접기' : '펼치기'/.test(sched), '월간일정: 펼치기/접기 토글 버튼이 없다');
want(/IconChevronsUp/.test(sched) && /IconChevronsDown/.test(sched), '월간일정: 토글 아이콘이 없다');

/* ── G2: 대시보드 월간일정 ── */
want(/const \[isCalExpanded, setIsCalExpanded\] = useState\(false\)/.test(dash), '대시보드: isCalExpanded 상태가 없다');
want(
  (dash.match(/isCalExpanded \? Number\.POSITIVE_INFINITY/g) || []).length >= 2,
  '대시보드: 펼침에서 일정 줄 수와 휴무자 줄 수 제한이 둘 다 풀리지 않는다',
);
want(/isCalExpanded \? '접기' : '펼치기'/.test(dash), '대시보드: 펼치기/접기 토글 버튼이 없다');
want(/IconChevronsUp/.test(dash) && /IconChevronsDown/.test(dash), '대시보드: 토글 아이콘이 없다');
want(/isCalExpanded \? daySchedules\.length : 3/.test(dash), '대시보드: 모바일 도트가 펼쳐도 3개에서 잘린다');

/* ── G3: 연간일정 ── */
want(/const \[expandAll, setExpandAll\] = useState\(false\)/.test(annual), '연간일정: expandAll 상태가 없다');
want(/expandAll \|\| !!expandedMonths\[index\]/.test(annual), '연간일정: 전체 펼침이 달마다 반영되지 않는다');
want(/expandAll \? '접기' : '펼치기'/.test(annual), '연간일정: 펼치기/접기 토글 버튼이 없다');
want(/hasOverflow/.test(annual), '연간일정: 접을 게 없을 때 버튼을 죽이는 처리가 없다');
want(/IconChevronsUp/.test(annual) && /IconChevronsDown/.test(annual), '연간일정: 토글 아이콘이 없다');

/* ── G4: 펼치면 행이 자란다 ── */
// CSS가 주 행에 flex:1을 걸어 높이를 균등분할한다. 이걸 풀지 않으면 펼쳐도 행이 안 자라
// 바가 칸 밖으로 넘쳐 잘린다. 두 달력 모두 펼침에서만 '0 0 auto'로 바꿔야 한다.
for (const [label, src, rowH] of [
  ['월간일정', sched, 'VACATION_ROW_HEIGHT'],
  ['대시보드', dash, 'DASH_VACATION_ROW_HEIGHT'],
]) {
  want(/'0 0 auto'/.test(src), `${label}: 펼침에서 주 행의 flex 균등분할을 풀지 않는다 — 행이 안 자란다`);
  want(new RegExp(rowH).test(src), `${label}: 휴무자 줄 높이 상수가 없어 휴무 전원 높이를 못 잡는다`);
  // 바 영역은 실제 lane 수로, 휴무 영역은 그 주 최다 휴무 인원으로 잡고 둘 중 큰 값을 쓴다.
  // 셋 중 하나라도 빠지면 펼쳤을 때 한쪽이 칸 밖으로 넘친다.
  want(/const barArea = [\s\S]{0,200}laneCount/.test(src), `${label}: 바 영역 높이가 실제 lane 수를 안 본다`);
  want(new RegExp(`const vacationArea = [\\s\\S]{0,200}maxPeople \\* ${rowH}`).test(src),
    `${label}: 휴무 영역 높이가 그 주 최다 휴무 인원을 안 본다`);
  want(/Math\.max\(barArea, vacationArea,/.test(src), `${label}: 행 높이가 바·휴무 중 큰 쪽을 따르지 않는다`);
}
// 계산한 높이가 실제로 행 style의 minHeight로 들어가야 한다 (계산만 하고 안 쓰면 소용없다)
want(/minHeight: Math\.max\(barArea, vacationArea, 120\)/.test(sched), '월간일정: 계산한 높이가 행 minHeight에 안 쓰인다');
want(/minHeight: isCalExpanded \? expandedMinHeight : DASH_CELL_FLOOR/.test(dash), '대시보드: 계산한 높이가 행 minHeight에 안 쓰인다');

done('calendar-expand-ok');
