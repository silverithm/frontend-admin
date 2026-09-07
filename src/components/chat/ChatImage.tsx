"use client";

import { useEffect, useRef, useState } from "react";
import { chatImageAttempt, type ChatImageAttempt } from "@/lib/chatImageRetry";

/**
 * 채팅 사진 한 장. **깨져 오면 스스로 다시 받는다.**
 *
 * 저장된 파일은 멀쩡한데도 화면에서만 깨져 보이는 일이 있었다(제보: "종종 사진 깨짐").
 * 사람이 새로고침을 눌러야 고쳐지는 것은 고쳐진 게 아니므로, 실패를 감지하면
 * 캐시를 건너뛰고 다시 받고, 그래도 안 되면 같은 출처 프록시로 내려받아 그린다.
 *
 * 규칙 자체는 chatImageRetry.ts에 있고 그쪽만 따로 테스트한다.
 */
export function ChatImage({
    src,
    alt,
    style,
    className,
    onClick,
}: {
    src?: string;
    alt: string;
    style?: React.CSSProperties;
    className?: string;
    onClick?: () => void;
}) {
    const [attempt, setAttempt] = useState(0);
    const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(src);
    const [failed, setFailed] = useState(false);
    const objectUrlRef = useRef<string | null>(null);

    // 다른 사진으로 바뀌면 처음부터 다시 센다
    useEffect(() => {
        setAttempt(0);
        setFailed(false);
    }, [src]);

    useEffect(() => {
        let cancelled = false;

        const revokeObjectUrl = () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };

        if (!src) {
            setResolvedSrc(undefined);
            return;
        }

        const plan: ChatImageAttempt = chatImageAttempt(src, attempt, Date.now());

        if (plan.kind === "direct" || plan.kind === "reload") {
            revokeObjectUrl();
            setResolvedSrc(plan.src);
            return;
        }

        if (plan.kind === "give-up") {
            setFailed(true);
            return;
        }

        // 같은 출처 프록시 — 토큰이 필요해 <img src>로는 못 부른다
        (async () => {
            try {
                const token = localStorage.getItem("authToken");
                const response = await fetch(
                    `/api/v1/files/download?path=${encodeURIComponent(plan.path)}`,
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                );
                if (!response.ok) throw new Error(`프록시 응답 ${response.status}`);
                const blob = await response.blob();
                if (cancelled) return;
                revokeObjectUrl();
                const objectUrl = URL.createObjectURL(blob);
                objectUrlRef.current = objectUrl;
                setResolvedSrc(objectUrl);
            } catch {
                if (!cancelled) setFailed(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [src, attempt]);

    // 화면에서 사라질 때 blob 주소를 정리한다
    useEffect(() => () => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    }, []);

    if (!src || failed) {
        return (
            <div
                className={className}
                style={{
                    ...style,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--color-background-muted)",
                    color: "var(--color-text-secondary)",
                    fontSize: "var(--font-size-sm)",
                }}
            >
                사진을 불러오지 못했습니다
            </div>
        );
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={resolvedSrc}
            alt={alt}
            style={style}
            className={className}
            onClick={onClick}
            // 다음 수단으로 넘어간다 (캐시 우회 → 같은 출처 프록시 → 포기).
            // 시도 횟수를 넘어서면 chatImageAttempt가 give-up을 돌려주고 안내 문구가 뜬다.
            onError={() => setAttempt((n) => n + 1)}
        />
    );
}

export default ChatImage;
