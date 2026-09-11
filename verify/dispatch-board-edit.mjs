// 배차표를 손으로 고치는 기능이 **배차표를 그리는 모든 화면**에 배선됐는지 본다.
//
// 이 화면은 두 곳에서 그려진다 — 관리자는 ScheduleCalendar(mode="dispatch"),
// 직원은 DispatchManagement. 처음 만들 때 직원 쪽에만 연결해 두는 바람에,
// 코드는 멀쩡한데 관리자 화면에서는 '수정' 버튼이 아예 나오지 않았다.
// 눈으로 세면 또 놓친다.
import { WEB, read, want, done } from './_lib.mjs';

const board = read(`${WEB}/src/components/DispatchBoard.tsx`);
const algorithm = read(`${WEB}/src/lib/dispatchAlgorithm.ts`);
const api = read(`${WEB}/src/lib/apiService.ts`);

// 배차표를 그리는 화면을 전부 찾는다 (새 화면이 생겨도 여기 걸린다)
const hosts = ['src/components/ScheduleCalendar.tsx', 'src/components/DispatchManagement.tsx'];

for (const host of hosts) {
    const source = read(`${WEB}/${host}`);
    if (!/<DispatchBoard/.test(source)) continue;

    want(
        /overrides=\{/.test(source) && /onOverridesChange=\{/.test(source),
        `${host}가 배차표에 수정본을 넘기지 않는다 — 그 화면에서는 '수정' 버튼이 아예 나오지 않는다`,
    );
    want(
        /getDispatchOverrides\(/.test(source),
        `${host}가 그날 수정본을 불러오지 않는다 — 다른 화면에서 옮긴 배차가 여기서만 사라진다`,
    );
    want(
        /saveDispatchOverrides\(/.test(source),
        `${host}가 옮긴 결과를 저장하지 않는다 — 새로고침하면 되돌아간다`,
    );
}

// 저장·되돌리기·조회가 실제로 있는지
for (const fn of ['getDispatchOverrides', 'saveDispatchOverrides', 'clearDispatchOverrides']) {
    want(api.includes(`export async function ${fn}`), `apiService에 ${fn}가 없다`);
}

// 끌어놓기 자체
want(/draggable/.test(board), '배차표에서 이름을 끌 수 없다');
want(/onDrop=\{/.test(board), '배차표에 놓을 자리가 없다');
// 평소에도 끌리면 명단을 보다가 손이 미끄러져 바뀐다
want(/isEditing/.test(board), '편집 모드 없이 항상 끌린다');

// 설정 원본을 건드리면 오늘 옮긴 것이 내일까지 따라간다
want(
    /applyDispatchOverrides/.test(algorithm) && /export function applyDispatchOverrides/.test(algorithm),
    '그날 수정본을 얹는 규칙이 없다',
);
want(
    /return seniors\.map\(/.test(algorithm),
    '수정본을 원본 명단에 직접 쓰고 있다 — 오늘 옮긴 것이 내일 배차까지 바꾼다',
);

done('배차표 수정 배선 확인');
