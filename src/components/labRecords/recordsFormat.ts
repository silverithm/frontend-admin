'use client';

/**
 * 2차 기록 화면 공용 계산 — 소수점 입력, 늦게 온 응답 막기, AI 제안 합치기, 월 목록.
 * 날짜·월 계산은 실험실 공용(labFormat·labDate)의 한국 달력 규칙을 그대로 쓴다.
 */
import { useEffect, useRef, useState } from 'react';
import { addDays } from '@/lib/lab/programRules';
import { parseYmd } from '@/lib/lab/labDate';

/** 화면이 사라진 뒤에 늦게 온 응답이 상태를 건드리지 않게 하는 표식 */
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}

/** 값이 멈춘 뒤 ms만큼 지나서야 바뀌는 값 — 숫자를 치는 도중의 "1", "25" 같은 중간값을 판정하지 않으려는 것 */
export function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * 소수 입력칸 글자 정리 — 숫자와 소수점만 남기고, 쉼표는 소수점으로 읽는다("36,5" → "36.5").
 * decimals가 0이면 정수만. 정수부는 4자리까지.
 */
export function sanitizeDecimal(text: string, decimals: number): string {
  const t = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = t.indexOf('.');
  if (dot === -1) return t.slice(0, 4);
  const head = t.slice(0, dot).slice(0, 4);
  if (decimals <= 0) return head;
  return `${head}.${t.slice(dot + 1).replace(/\./g, '').slice(0, decimals)}`;
}

/** 입력 글자를 숫자로. 비었거나 "." 만 있으면 null */
export function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (t === '' || t === '.') return null;
  const value = Number(t);
  return Number.isFinite(value) ? value : null;
}

/** 숫자를 입력칸 글자로 (정수는 소수점 없이) */
export function numberText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 'YYYY-MM-DD'에서 'YYYY-MM' */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** from~to 날짜 사이에 걸치는 달('YYYY-MM') 목록(오래된 순) */
export function monthsBetween(from: string, to: string): string[] {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return [];
  const out: string[] = [];
  let index = a.year * 12 + (a.month - 1);
  const last = b.year * 12 + (b.month - 1);
  while (index <= last) {
    out.push(`${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`);
    index += 1;
  }
  return out;
}

/** date에서 days일 전 날짜. 잘못된 날짜면 그대로 돌려준다 */
export function daysAgo(date: string, days: number): string {
  return addDays(date, -days) ?? date;
}

/** id가 같은 항목은 뒤의 것을 쓴다 */
export function dedupeById<T extends { id: number }>(items: ReadonlyArray<T>): T[] {
  const map = new Map<number, T>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

export interface AiMerge<K extends string> {
  fields: Record<K, string>;
  ai: Partial<Record<K, true>>;
  /** 직원이 직접 쓴 칸이라 AI 제안으로 바꾸지 않은 칸 수 */
  kept: number;
}

/**
 * AI 제안을 칸에 합친다. 비어 있거나 이전 AI 제안인 칸만 채우고, 직접 쓴 칸은 덮어쓰지 않는다.
 * 반드시 setState 갱신 함수 안에서 부르고, 결과의 kept는 그 결과 안에서만 쓴다(함수 밖에서 세지 않는다).
 */
export function mergeAiSuggestions<K extends string>(
  current: Record<K, string>,
  marks: Partial<Record<K, true>>,
  suggestions: Partial<Record<K, string | null | undefined>>,
  maxLength: Record<K, number>,
): AiMerge<K> {
  const fields = { ...current };
  const ai = { ...marks };
  let kept = 0;
  for (const key of Object.keys(maxLength) as K[]) {
    const suggested = (suggestions[key] ?? '').trim().slice(0, maxLength[key]);
    if (suggested === '') continue;
    if (fields[key].trim() === '' || ai[key]) {
      fields[key] = suggested;
      ai[key] = true;
    } else if (fields[key].trim() !== suggested) {
      kept += 1;
    }
  }
  return { fields, ai, kept };
}

/** 이름 정렬(가나다) */
export function byKoreanName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'ko');
}

/** 대시 없이 오늘 기준 연도 */
export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** 렌더마다 최신 값을 담아 두는 표 — 비동기 응답이 도착한 시점의 최신 입력을 읽는 데 쓴다 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
