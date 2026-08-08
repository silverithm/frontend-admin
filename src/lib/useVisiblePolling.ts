'use client';

import { useEffect, useRef } from 'react';

/**
 * 화면을 보고 있을 때만 도는 주기 갱신.
 *
 * 그냥 setInterval로 돌리면 하루 종일 열어둔 탭 하나가 아무도 보지 않는 동안
 * 수천 건을 만든다. 실제로 채팅방 목록 폴링이 하루 요청의 3분의 2를 차지했다.
 *
 * - 마운트 시 한 번 즉시 실행
 * - 탭이 숨겨지면 멈추고, 다시 보이면 곧바로 한 번 받아 최신으로 맞춘 뒤 재개
 *
 * 콜백은 ref에 담아두므로 매 렌더마다 새 함수를 넘겨도 타이머가 다시 잡히지 않는다.
 */
export function useVisiblePolling(callback: () => void, intervalMs: number) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        let timerId: ReturnType<typeof setInterval> | null = null;

        const stop = () => {
            if (timerId !== null) {
                clearInterval(timerId);
                timerId = null;
            }
        };

        const start = () => {
            stop();
            timerId = setInterval(() => callbackRef.current(), intervalMs);
        };

        const isVisible = () =>
            typeof document === 'undefined' || document.visibilityState === 'visible';

        const handleVisibilityChange = () => {
            if (isVisible()) {
                callbackRef.current();
                start();
            } else {
                stop();
            }
        };

        callbackRef.current();
        if (isVisible()) start();

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [intervalMs]);
}
