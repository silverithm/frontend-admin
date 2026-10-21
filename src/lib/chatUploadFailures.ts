/**
 * 채팅 파일 여러 개를 한 번에 보낼 때 실패한 것을 모아 한 문장으로 알린다.
 *
 * 전에는 실패마다 "파일 전송에 실패했습니다"만 떠서 여러 장 중 **어느 파일이** 안 갔는지 알 수 없었고,
 * 떠 있는 채팅창은 다음 파일을 보내기 시작할 때 그 문구마저 지웠다(버그제보 2026-10-16
 * "전송이 안 된 사진이나 동영상이 어떤 건지 알 수가 없어요").
 */
export type ChatUploadFailure = { name: string; reason: 'tooLarge' | 'failed' };

/** 이름은 이만큼까지만 늘어놓고 나머지는 "외 n개"로 줄인다 — 알림이 화면을 덮지 않게 */
const MAX_LISTED = 5;

export function describeUploadFailures(failures: ChatUploadFailure[], maxMb: number): string | null {
    if (failures.length === 0) return null;
    if (failures.length === 1) {
        const [only] = failures;
        return only.reason === 'tooLarge'
            ? `${only.name}은(는) ${maxMb}MB를 넘어 보낼 수 없습니다`
            : `${only.name}을(를) 보내지 못했습니다. 다시 첨부해 주세요`;
    }
    const listed = failures.slice(0, MAX_LISTED).map((f) => (f.reason === 'tooLarge' ? `${f.name}(${maxMb}MB 초과)` : f.name));
    const rest = failures.length - listed.length;
    return `${failures.length}개를 보내지 못했습니다: ${listed.join(', ')}${rest > 0 ? ` 외 ${rest}개` : ''}. 다시 첨부해 주세요`;
}
