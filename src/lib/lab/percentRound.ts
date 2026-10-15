/**
 * 백분율을 소수 첫째 자리로 반올림한다. 분자·분모는 정수만 받고 정수 곱셈으로 셈해 0.05 경계에서 부동소수 오차가 나지 않는다.
 * (예: 7/80 = 8.75% → 8.8, 1/3 = 33.333…% → 33.3). 분모가 0 이하이거나 정수가 아니면 null.
 */
export function percentOneDecimal(numerator: number, denominator: number): number | null {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0 || numerator < 0) return null;
  return Math.round((numerator * 1000) / denominator) / 10;
}
