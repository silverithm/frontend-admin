/**
 * 업무진행도 — 대시보드 오른쪽 패널의 업무 목록(2026-10-22 원장 요청 "이름은 업무진행도").
 * 서버(/api/v1/work-tasks)가 순서(진행 중: 중요 → 기한 → 등록순, 그 아래 최근 끝낸 것)까지 정해 준다.
 */
export type WorkTaskImportance = 'HIGH' | 'NORMAL' | 'LOW';

export interface WorkTaskPerson {
  /** 채팅 식별자 — 직원 "12", 관리자 "admin_3" */
  id: string;
  name: string | null;
}

export interface WorkTask {
  id: number;
  content: string;
  importance: WorkTaskImportance;
  progress: number;
  dueDate: string | null;
  assignees: WorkTaskPerson[];
  createdBy: WorkTaskPerson;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface WorkTaskInput {
  content: string;
  importance: WorkTaskImportance;
  progress: number;
  dueDate: string | null;
  /** 비면 서버가 등록한 사람 자신으로 정한다 */
  assigneeIds: string[];
}

/** 중요도는 색으로 — 색만으로 구분하지 않도록 글자(중요·보통·낮음)도 함께 쓴다 */
export const IMPORTANCE_META: Record<WorkTaskImportance, { label: string; tone: 'red' | 'yellow' | 'gray'; gauge: 'error' | 'warning' | 'neutral' }> = {
  HIGH: { label: '중요', tone: 'red', gauge: 'error' },
  NORMAL: { label: '보통', tone: 'yellow', gauge: 'warning' },
  LOW: { label: '낮음', tone: 'gray', gauge: 'neutral' },
};

export const IMPORTANCE_ORDER: WorkTaskImportance[] = ['HIGH', 'NORMAL', 'LOW'];

/** 수행도는 10% 단위로 고른다 — 1% 단위는 손으로 맞추기만 어렵고 뜻이 없다 */
export const PROGRESS_STEP = 10;

export function isDone(task: Pick<WorkTask, 'progress' | 'completedAt'>): boolean {
  return task.completedAt != null || task.progress >= 100;
}

export function splitTasks(tasks: WorkTask[]): { inProgress: WorkTask[]; done: WorkTask[] } {
  return {
    inProgress: tasks.filter((t) => !isDone(t)),
    done: tasks.filter((t) => isDone(t)),
  };
}

/** 'yyyy-MM-dd' 두 날짜 사이의 날 수 (시간대에 흔들리지 않게 정오 UTC로 센다) */
function daysBetween(from: string, to: string): number {
  const at = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day, 12);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

export type DueTone = 'overdue' | 'soon' | 'normal';

/**
 * 목록 한 줄에 붙이는 기한 — 지난 것 "10/20 지남", 오늘 "오늘까지", 내일 "내일까지", 사흘 안 "D-3", 나머지 "10/31".
 * @param today 'yyyy-MM-dd' (서울 기준 오늘)
 */
export function dueLabel(due: string | null, today: string): { text: string; tone: DueTone } | null {
  if (!due) return null;
  const days = daysBetween(today, due);
  const [, m, d] = due.split('-').map(Number);
  if (days < 0) return { text: `${m}/${d} 지남`, tone: 'overdue' };
  if (days === 0) return { text: '오늘까지', tone: 'overdue' };
  if (days === 1) return { text: '내일까지', tone: 'soon' };
  if (days <= 3) return { text: `D-${days}`, tone: 'soon' };
  return { text: `${m}/${d}`, tone: 'normal' };
}

/** "박소향", "박소향 외 2" */
export function assigneeLabel(assignees: WorkTaskPerson[]): string {
  const names = assignees.map((a) => a.name?.trim()).filter((n): n is string => !!n);
  if (names.length === 0) return '담당자 없음';
  return names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}`;
}

/** 내가 맡은 진행 중 업무 수 — 패널을 접었을 때 배지 */
export function myInProgressCount(tasks: WorkTask[], meId: string | null): number {
  if (!meId) return 0;
  return tasks.filter((t) => !isDone(t) && t.assignees.some((a) => a.id === meId)).length;
}

/** 서울 기준 오늘 'yyyy-MM-dd' */
export function seoulToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** 바깥(알림 팝업 등)에서 업무 하나를 열어 달라는 신호 — 패널이 받아서 그 업무 창을 연다 */
export const OPEN_WORK_TASK_EVENT = 'carev:open-work-task';

export function requestOpenWorkTask(taskId: number | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_WORK_TASK_EVENT, { detail: { taskId } }));
}
