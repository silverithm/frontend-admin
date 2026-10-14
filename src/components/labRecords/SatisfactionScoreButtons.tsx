'use client';

/** 문항 하나의 1~5점 단추 — 한 칸이 56px 높이라 손가락으로 누르기 쉽다. 같은 점수를 다시 누르면 선택이 풀린다. */
import { Text } from '@astryxdesign/core/Text';
import { SCORE_LABELS } from '@/lib/lab/satisfactionRules';
import own from './Satisfaction.module.css';

interface Props {
  text: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export default function SatisfactionScoreButtons({ text, value, onChange }: Props) {
  return (
    <div className={own.questionBlock} role="group" aria-label={text}>
      <Text type="label">{text}</Text>
      <div className={own.scoreRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={own.scoreButton} aria-pressed={value === n} aria-label={`${n}점 ${SCORE_LABELS[n]}`} onClick={() => onChange(value === n ? undefined : n)}>
            <span className={own.scoreNum}>{n}</span>
            <span className={own.scoreWord}>{SCORE_LABELS[n]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
