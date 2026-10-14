'use client';

/** 한 가지 목록을 불러오는 훅 — 로딩·한글 오류·다시 불러오기, 늦게 온 응답은 버린다. load는 useCallback으로 감싸 넘긴다. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/components/lab/labFormat';

export function useRecordsLoader<T>(load: () => Promise<T>, fallbackMessage: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await load();
      if (id !== seq.current) return;
      setData(result);
    } catch (e) {
      if (id !== seq.current) return;
      setError(errorText(e, fallbackMessage));
    } finally {
      if (id === seq.current) setIsLoading(false);
    }
  }, [load, fallbackMessage]);

  useEffect(() => {
    void reload();
    return () => {
      seq.current += 1;
    };
  }, [reload]);

  return { data, isLoading, error, reload };
}
