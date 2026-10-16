import { createSchedule } from '@/lib/apiService';
import { expandRepeatDates, shiftDate } from './scheduleRepeat';
import type { RepeatRule } from './scheduleRepeat';

type ScheduleInput = Parameters<typeof createSchedule>[0];

/**
 * 반복 규칙대로 일정을 날짜마다 한 건씩 등록한다. 알림은 첫 건에만 보내 같은 알림이 여러 번 가지 않게 한다.
 * 중간에 실패하면 거기서 멈추고 몇 건까지 만들었는지 알려 준다(이미 만든 건 그대로 둔다).
 */
export async function createRepeatedSchedules(base: ScheduleInput, rule: RepeatRule): Promise<{ created: number; total: number; error?: unknown }> {
  const starts = expandRepeatDates(base.startDate, rule);
  let created = 0;
  for (const [i, start] of starts.entries()) {
    try {
      await createSchedule({
        ...base,
        startDate: start,
        endDate: shiftDate(base.endDate, base.startDate, start),
        sendNotification: i === 0 ? base.sendNotification : false,
      });
      created += 1;
    } catch (error) {
      return { created, total: starts.length, error };
    }
  }
  return { created, total: starts.length };
}
