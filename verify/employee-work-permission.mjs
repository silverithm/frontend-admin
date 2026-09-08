// 권한을 켜 준 직원이 관리자와 같은 근무조정 화면을 쓰는지, 말풍선이 너무 넓어지지 않는지 본다.
//
// 1) 근무조정 관리 권한(WORK_MANAGE)은 켜 줄 수는 있는데 **어디에서도 검사하지 않았다.**
//    사무국장님께 아홉 개 권한을 전부 켜 두고도 승인을 못 하신 이유가 그것이다.
//    권한이 코드에서 실제로 쓰이는지, 직원 화면이 관리자 달력과 승인 패널을 그리는지 본다.
//
// 2) 말풍선이 채팅 영역의 70%까지 늘어나 넓은 화면에서 한 줄이 1000px를 넘었다.
//    답장 미리보기는 한 줄로 그려서 그 길이만큼 말풍선이 통째로 늘어났다.
import { WEB, read, want, done } from './_lib.mjs';

const employeePage = read(`${WEB}/src/app/employee/page.tsx`);
const chat = read(`${WEB}/src/components/ChatManagement.tsx`);

// --- 1) 근무조정 권한 ---

// 권한 이름이 타입 정의에만 있고 아무 데서도 안 쓰이면 켜 봐야 소용이 없다
want(
    /hasPermission\('WORK_MANAGE'\)/.test(employeePage),
    "직원 화면이 WORK_MANAGE 권한을 보지 않는다 — 권한을 켜도 아무것도 달라지지 않는다",
);

// 관리자와 같은 달력을 쓰는지 (직원 전용 달력은 조회만 된다)
want(
    /<VacationCalendar/.test(employeePage),
    '직원 화면이 관리자 달력(VacationCalendar)을 쓰지 않는다',
);

// 승인할 자리가 있는지 — 달력만 있으면 여전히 승인을 못 한다
want(
    /<PendingVacationApprovals/.test(employeePage),
    '직원 화면에 승인 패널(PendingVacationApprovals)이 없다',
);

// 권한이 없는 직원은 예전처럼 조회용 달력을 봐야 한다
want(
    /<EmployeeCalendar\s*\/>/.test(employeePage),
    '권한 없는 직원이 볼 조회용 달력(EmployeeCalendar)이 사라졌다',
);

// 승인 패널이 실제로 승인·반려·일괄승인을 부르는지
const panel = read(`${WEB}/src/components/work/PendingVacationApprovals.tsx`);
for (const api of ['approveVacation', 'rejectVacation', 'bulkApproveVacations']) {
    want(panel.includes(api), `승인 패널이 ${api}를 부르지 않는다`);
}

// --- 2) 말풍선 폭 ---

want(
    /maxWidth: "min\(70%, 560px\)"/.test(chat),
    '채팅 말풍선에 폭 상한이 없다 — 넓은 화면에서 한 줄이 화면을 가로지른다',
);

done('직원 근무조정 권한·말풍선 폭 확인');
