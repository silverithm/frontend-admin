/**
 * 사업자 정보 — 화면에 표시하는 곳은 전부 여기서 읽는다.
 *
 * 전자상거래법·PG 심사(토스페이먼츠)가 사이트 하단에 요구하는 항목:
 * 상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 사업장 주소, 전화번호, 이메일.
 * 예전에는 랜딩·관리자·직원 화면이 각자 문자열을 들고 있어서 주소에 구가 빠지고,
 * 상호가 'silverithm' / '실버리즘' / '(주)실버리즘'으로 제각각이었다.
 * 상호는 사업자등록증과 글자까지 같아야 심사를 통과한다.
 *
 * 출처(2026-10-10 대조): 사업자등록증명(관악세무서, 일반과세자)과 통신판매업신고증(관악구청 2025-05-26).
 * 예전 주소 '신림동 1547-10'은 두 서류 어디에도 없는 표기였다.
 */
export const BUSINESS_INFO = {
    serviceName: '케어브이',
    companyName: '실버리즘',
    representative: '김준형',
    registrationNumber: '107-21-26475',
    /** 통신판매업 신고번호 — 없으면 PG 심사에서 국민카드가 빠진다. */
    mailOrderNumber: '제2025-서울관악-0876호' as string | null,
    address: '서울특별시 관악구 대학10길 41-8, 1층 101호(신림동)',
    phone: '010-4549-2094',
    email: 'ggprgrkjh2@gmail.com',
} as const;

export const LEGAL_LINKS = {
    privacy: 'https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html',
    terms: 'https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d',
    refund: '/refund-policy',
} as const;
