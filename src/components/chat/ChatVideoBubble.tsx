"use client";

import { Text } from "@astryxdesign/core/Text";

/**
 * 동영상 첨부 말풍선 — 파일 줄(📎) 대신 그 자리에서 바로 재생한다.
 *
 * **첫 프레임을 서버에 저장하지 않는다.** preload="metadata"면 브라우저가 영상에서
 * 직접 첫 프레임을 그려 표지로 삼는다. 서버가 만들어 저장하는 방식이면 앞으로 올리는
 * 것만 썸네일이 생기고 이미 올라간 동영상은 영영 안 생기는데, 이 방식은 옛 동영상까지
 * 전부 살아난다. 앱도 같은 원리로 영상에서 직접 뽑는다(VideoThumbnailCache).
 *
 * 데이터도 아낀다 — preload="metadata"는 HTTP 범위 요청으로 메타데이터와 첫 프레임에
 * 필요한 앞부분만 받는다(S3는 범위 요청을 지원한다). 영상 전체를 내려받지 않는다.
 *
 * 페이드인으로 시작해 첫 프레임이 새까만 영상도 흔한데, 그때도 controls의 재생 버튼이
 * 항상 떠 있어 동영상이라는 것은 분명히 드러난다. 그래서 표지를 억지로 뒤로 감지 않는다
 * (미디어 조각 `#t=`으로 옮기면 표지는 살지만 재생 시작점까지 함께 밀린다).
 *
 * 재생을 못 하는 형식/브라우저를 위해 안쪽에 원본 링크를 남기고,
 * 파일 이름을 아래에 그대로 두어 '첨부'로도 읽히게 한다.
 */
export function ChatVideoBubble({
    fileUrl,
    fileName,
    posterUrl,
    maxHeight,
}: {
    fileUrl: string;
    fileName?: string;
    posterUrl?: string;
    maxHeight: number;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 'var(--spacing-1)' }}>
            <video
                src={fileUrl}
                controls
                preload="metadata"
                playsInline
                poster={posterUrl || undefined}
                style={{
                    display: "block",
                    maxWidth: "100%",
                    maxHeight,
                    borderRadius: 'var(--radius-container)',
                    backgroundColor: "#000",
                }}
            >
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    {fileName || "동영상"} 내려받기
                </a>
            </video>
            {fileName && (
                <Text type="supporting" color="inherit" maxLines={1}>{fileName}</Text>
            )}
        </div>
    );
}

export default ChatVideoBubble;
