/**
 * 배차표를 손으로 고칠 때의 자리 계산.
 *
 * 화면(DispatchBoard)에서 분리해 둔다 — 끌어놓는 조작은 눈으로 확인하기 어렵고,
 * 잘못되면 명단 순서가 조용히 어긋나므로 따로 시험할 수 있어야 한다.
 */

/**
 * 떨어뜨린 자리의 탑승 순서를 구한다.
 *
 * [index]가 -1이면 맨 뒤, 0이면 맨 앞, 그 외에는 앞사람과 뒷사람의 사이값이다.
 * 사이값이 소수여도 정렬에는 문제가 없다 — 순서는 크기 비교로만 쓰인다.
 * 정수로 다시 매기면 같은 차에 탄 나머지 분들의 순서까지 전부 그날 수정본에 넣어야 하고,
 * 그러면 나중에 설정에서 순서를 바꿔도 그날만 옛 순서로 남는다.
 */
export function nextBoardingOrder(list: { boardingOrder: number }[], index: number): number {
  if (list.length === 0) return 1;
  if (index < 0) return list[list.length - 1].boardingOrder + 1;
  if (index === 0) return list[0].boardingOrder - 1;
  return (list[index - 1].boardingOrder + list[index].boardingOrder) / 2;
}
