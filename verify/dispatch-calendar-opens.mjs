// 배차관리 달력이 "달력을 불러오는 중..."에서 멈추지 않는지.
//
// ScheduleCalendar는 isLoading을 true로 시작해 일정 API를 받은 뒤 내린다. 그런데 배차 모드는
// 일정 API를 쓰지 않아 loadSchedules()를 부르지 않았고, 그래서 로딩이 영영 안 내려갔다.
// 화면은 배차표(로딩 게이트 위에 그려진다)는 보여주고 달력만 멈춰, "떴다가 로딩으로 바뀐다"로 보였다.
import { WEB, read, want, done } from './_lib.mjs';

const src = read(`${WEB}/src/components/ScheduleCalendar.tsx`);

// 달력 그리드는 isLoading 게이트 뒤에 있다 — 이 전제가 깨지면 아래 검사가 무의미해진다
want(/isLoading \? \(\s*<Loading label="달력을 불러오는 중\.\.\."/.test(src),
  '달력 로딩 게이트를 못 찾았다 — 이 검사가 무엇을 지키는지 다시 확인하라');

// 배차 모드에서 로딩을 내리는 자리가 있어야 한다
const effect = /\/\/ 일정 데이터 로드\s*\n\s*useEffect\(\(\) => \{[\s\S]*?\}, \[currentDate, isDispatchMode\]\);/.exec(src)?.[0];
want(Boolean(effect), '일정 로드 effect를 못 찾았다');
want(/\}\s*else\s*\{[\s\S]*?setIsLoading\(false\);/.test(effect ?? ''),
  '배차 모드에서 setIsLoading(false)를 하지 않는다 — 달력이 영영 로딩에서 안 돌아온다');

done('DISPATCH_CALENDAR_OPENS_OK');
