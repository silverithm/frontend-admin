/**
 * 채팅 사진이 깨져 보일 때 다시 받아오는 규칙.
 *
 * "종종 사진 깨짐 현상이 발생함" 제보를 받고 저장된 파일부터 확인했다 —
 * 원본·축소본 770개의 끝 바이트를 검사했고 잘린 파일은 하나도 없었다
 * (끝이 이상해 보이던 43개는 삼성 모션포토의 SEF 꼬리로, JPEG 자체는 온전했다).
 * 즉 S3에 있는 파일은 멀쩡하고, 브라우저가 받는 도중이나 그리는 도중에 깨진다.
 *
 * 그래서 화면에서 스스로 복구하게 한다. 사람이 새로고침을 눌러야 고쳐지는 것은
 * 고쳐진 게 아니다.
 */

/** 한 장을 최대 몇 번까지 시도할지 — 원본, 캐시 우회, 같은 출처 프록시 */
export const CHAT_IMAGE_MAX_ATTEMPTS = 3;

export type ChatImageAttempt =
    /** 있는 그대로 (브라우저 캐시 사용) */
    | { kind: 'direct'; src: string }
    /** 캐시를 건너뛰고 다시 받는다 — 깨진 응답이 캐시에 남아 있으면 새로고침해도 그대로다 */
    | { kind: 'reload'; src: string }
    /**
     * 같은 출처 프록시로 내려받아 blob으로 그린다.
     * S3에 직접 붙는 길이 흔들릴 때의 마지막 수단이고, 우리 서버가 온전히 중계한다.
     * 토큰이 필요하므로 <img src>가 아니라 fetch로 받아야 한다.
     */
    | { kind: 'proxy'; path: string }
    /** 더 해볼 것이 없다 */
    | { kind: 'give-up' };

/** 같은 주소를 캐시를 건너뛰고 다시 받도록 표시를 붙인다 (이미 물음표가 있어도 안전하게) */
export function cacheBustedUrl(src: string, stamp: number): string {
    const mark = `carevRetry=${stamp}`;
    if (!src.includes('?')) return `${src}?${mark}`;
    return `${src}&${mark}`;
}

/**
 * S3 절대 주소에서 프록시에 넘길 경로를 뽑는다.
 * 백엔드(FileAccessGuard)가 우리 버킷 절대 URL을 알아서 상대 경로로 바꿔 주므로
 * 주소를 그대로 넘겨도 되지만, 재시도 표시는 떼고 넘긴다.
 */
export function proxyPathOf(src: string): string {
    const [withoutHash] = src.split('#');
    const [base, query] = withoutHash.split('?');
    if (!query) return base;
    const kept = query
        .split('&')
        .filter((part) => part && !part.startsWith('carevRetry='))
        .join('&');
    return kept ? `${base}?${kept}` : base;
}

/**
 * 몇 번째 시도에 무엇을 할지.
 *
 * @param src     원래 이미지 주소
 * @param attempt 0부터 시작하는 시도 번호
 * @param stamp   캐시 우회 표시에 쓸 값 (호출자가 시각 등을 넣는다)
 */
export function chatImageAttempt(
    src: string,
    attempt: number,
    stamp: number,
): ChatImageAttempt {
    if (!src) return { kind: 'give-up' };
    if (attempt <= 0) return { kind: 'direct', src };
    if (attempt === 1) return { kind: 'reload', src: cacheBustedUrl(src, stamp) };
    if (attempt === 2) return { kind: 'proxy', path: proxyPathOf(src) };
    return { kind: 'give-up' };
}
