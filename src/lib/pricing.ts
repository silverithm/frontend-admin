/**
 * 판매 중인 요금제 — 랜딩·결제·구독 화면이 같은 값을 보여주도록 한 곳에 둔다.
 *
 * 금액은 서버 가격표(api-server SubscriptionPricing)가 최종 결정한다. 지금 판매하는 것은
 * Basic 월간 하나뿐이고(연간은 서버가 거부한다), 화면에 적힌 금액과 실제 결제 금액이
 * 다르면 PG 심사에서 반려된다. 가격을 바꿀 때는 서버 가격표와 이 파일을 함께 고친다.
 */
export const BASIC_PLAN = {
    name: 'Basic 플랜',
    orderName: 'Basic 플랜 월간 구독',
    monthlyAmount: 9900,
    priceLabel: '₩9,900',
    /** 결제 금액 안내 문구 — 부가세는 금액에 포함돼 있다. */
    amountLabel: '월 9,900원 (부가세 포함)',
} as const;

export const FREE_TRIAL_DAYS = 30;

/** 유료·무료 모두 같은 기능을 쓴다 — 기능 목록은 하나만 둔다. */
export const PLAN_FEATURES = [
    '휴무 신청·승인과 근무조정 캘린더',
    '월간일정·담당자·할 일 관리',
    '전자결재 (공문 양식·결재선·서명·직인)',
    '공지사항·실시간 채팅·케어브이 커뮤니티',
    '직원용 iOS·Android 앱',
    '직원 수 제한 없음',
];

/**
 * 오늘 결제했을 때 다음 자동 결제일. 서버는 결제 시점에 Java plusMonths(1)로 종료일을 잡는데,
 * 그건 달 끝을 넘기지 않는다(1/31 → 2/28). JS setMonth는 3/3으로 넘어가므로 똑같이 맞춘다.
 */
export function nextBillingDate(from: Date = new Date()): Date {
    const lastDayOfNextMonth = new Date(from.getFullYear(), from.getMonth() + 2, 0).getDate();
    return new Date(from.getFullYear(), from.getMonth() + 1, Math.min(from.getDate(), lastDayOfNextMonth));
}

export function formatKoreanDate(date: Date): string {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
