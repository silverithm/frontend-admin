/**
 * 채팅 목록을 '무엇을 한 덩어리로 그릴지'로 바꾸는 순수 로직 — React 없음.
 *
 * 관리자 채팅 탭(ChatManagement)과 직원 플로팅 채팅(FloatingChatMessages)이
 * 날짜 구분선 규칙과 사진 묶음 규칙을 똑같이 쓰도록 한곳에 둔다.
 */

// 이 파일은 **아무것도 import 하지 않는다.** Node 내장 테스트 러너(`npm run test:chat`)가
// 이 파일을 직접 불러 돌리는데, Node의 ESM 해석기는 확장자를 붙여주지 않기 때문이다.
// 다른 모듈을 하나라도 끌어오면 앱 코드에 './x.ts' 같은 확장자를 박아야 하고,
// 그건 번들러(webpack/turbopack)에 굳이 지지 않아도 될 위험을 지우는 일이다.
// 그래서 첨부 종류 판정도 아래에 함께 두고, chatAttachments.ts가 그것을 다시 내보낸다.

/**
 * 묶기 판단에 실제로 필요한 필드만 구조적으로 받는다.
 * 두 화면이 각자 ChatMessage 타입을 갖고 있어(합치는 건 이번 작업 범위 밖) 제네릭으로 흘려보낸다.
 */
export interface GroupableChatMessage {
    id: number;
    senderId: string;
    type: string;
    createdAt: string;
    isDeleted: boolean;
    fileUrl?: string;
    fileName?: string;
    mediaType?: string;
    mimeType?: string;
}

/** 'YYYY-MM-DD' — 날짜 구분선을 넣을지 판단하는 기준 키 (로컬 시간 기준) */
export function getDateKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 날짜 구분선에 쓸 문구 — 오늘/어제는 말로, 그 밖은 날짜로 */
export function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 사진을 한 묶음으로 볼 시간 간격 — 1분.
 * 한 번에 여러 장을 고르면 서버 업로드가 순차라 몇 초씩 벌어지고,
 * "방금 찍어 연달아 보낸 것"까지 넉넉히 담으면서 나중에 따로 보낸 사진은 안 삼키는 폭이다.
 */
export const PHOTO_GROUP_MAX_GAP_MS = 60_000;

/**
 * 한 묶음에 담을 최대 장수 — 9장(3×3).
 * 10장째는 '+N' 덮개를 씌우지 않고 새 묶음을 시작한다. 그래야 모든 사진이
 * 목록에서 그대로 보이고, 덮개 뒤에 사진이 숨는 일이 없다.
 */
export const PHOTO_GROUP_MAX_COUNT = 9;

export type ChatRenderItem<M extends GroupableChatMessage = GroupableChatMessage> =
    | { kind: "single"; message: M; showDateSeparator: boolean; showSenderHeader: boolean }
    | { kind: "photos"; messages: M[]; showDateSeparator: boolean; showSenderHeader: boolean };

/** 이 메시지가 '사진 묶음에 들어갈 수 있는 사진'인가 */
function isGroupablePhoto(message: GroupableChatMessage): boolean {
    if (message.isDeleted) return false;
    if (!message.fileUrl) return false;
    return chatMediaType(message) === 'IMAGE';
}

/**
 * 오래된 것부터(오름차순) 들어온 메시지 배열을 화면에 그릴 단위로 접는다.
 * 두 화면 모두 messages를 오름차순으로 들고 있으므로 그 순서를 전제한다.
 *
 * 같은 사람이 연달아 보낸 사진만 묶는다. 사이에 글이 끼거나, 보낸 사람이 바뀌거나,
 * 1분을 넘기거나, 날짜가 바뀌면 끊는다. 특히 날짜는 시간 간격과 별개로 반드시 끊어야 한다 —
 * 23:59:50 → 00:00:10은 20초 차이지만 사이에 날짜 구분선이 들어가야 하고,
 * 묶음이 구분선을 타고 넘으면 구분선이 사라져 버린다.
 */

/** 항목의 첫 메시지 (사진 묶음이면 그 묶음의 첫 장) */
function firstOf<M extends GroupableChatMessage>(item: ChatRenderItem<M>): M {
    return item.kind === "photos" ? item.messages[0] : item.message;
}

/** 항목의 마지막 메시지 (사진 묶음이면 그 묶음의 마지막 장) */
function lastOf<M extends GroupableChatMessage>(item: ChatRenderItem<M>): M {
    return item.kind === "photos" ? item.messages[item.messages.length - 1] : item.message;
}

/**
 * 각 항목이 '보낸 사람 묶음의 첫 항목'인지 표시한다 — 아바타와 이름줄은 여기에만 그린다.
 *
 * 앱의 isSenderGroupStart(lib/utils/chat_message_grouping.dart)와 같은 규칙이다.
 * 사람이 바뀌거나, 날짜가 바뀌거나, 사이에 시스템 메시지가 끼면 묶음을 끊는다.
 * 규칙이 어긋나면 같은 대화가 두 화면에서 다르게 묶인다.
 */
function markSenderHeaders<M extends GroupableChatMessage>(items: ChatRenderItem<M>[]): ChatRenderItem<M>[] {
    return items.map((item, index) => {
        if (index === 0) return { ...item, showSenderHeader: true };

        const current = firstOf(item);
        const previous = lastOf(items[index - 1]);

        const changed =
            current.type === "SYSTEM" ||
            previous.type === "SYSTEM" ||
            previous.senderId !== current.senderId ||
            getDateKey(previous.createdAt) !== getDateKey(current.createdAt);

        return { ...item, showSenderHeader: changed };
    });
}

export function buildChatRenderItems<M extends GroupableChatMessage>(messages: M[]): ChatRenderItem<M>[] {
    const items: ChatRenderItem<M>[] = [];
    let group: M[] = [];
    let groupShowsSeparator = false;

    /** 모아둔 사진을 실제 항목으로 내보낸다 — 1장이면 지금까지와 똑같이 단일 말풍선으로 */
    const flush = () => {
        if (group.length === 0) return;
        if (group.length === 1) {
            items.push({ kind: "single", message: group[0], showDateSeparator: groupShowsSeparator, showSenderHeader: false });
        } else {
            items.push({ kind: "photos", messages: group, showDateSeparator: groupShowsSeparator, showSenderHeader: false });
        }
        group = [];
        groupShowsSeparator = false;
    };

    for (let index = 0; index < messages.length; index++) {
        const message = messages[index];
        // 구분선은 지금까지와 똑같이 '바로 앞 메시지와 날짜가 다른가'로 정한다.
        // 묶음의 첫 사진에 붙으므로 묶은 뒤에도 위치가 어긋나지 않는다.
        const showDateSeparator =
            index === 0 || getDateKey(message.createdAt) !== getDateKey(messages[index - 1].createdAt);

        if (!isGroupablePhoto(message)) {
            flush();
            items.push({ kind: "single", message, showDateSeparator, showSenderHeader: false });
            continue;
        }

        const last = group[group.length - 1];
        const continues =
            last !== undefined &&
            group.length < PHOTO_GROUP_MAX_COUNT &&
            last.senderId === message.senderId &&
            getDateKey(last.createdAt) === getDateKey(message.createdAt) &&
            new Date(message.createdAt).getTime() - new Date(last.createdAt).getTime() <= PHOTO_GROUP_MAX_GAP_MS;

        if (!continues) {
            flush();
            groupShowsSeparator = showDateSeparator;
        }
        group.push(message);
    }
    flush();

    // 보낸 사람이 바뀌는 지점을 표시한다 — 아바타와 이름줄은 거기에만 그린다.
    return markSenderHeaders(items);
}

// ---------------------------------------------------------------------------
// 첨부 종류 판정 (chatAttachments.ts가 이 세 가지를 다시 내보낸다)
// ---------------------------------------------------------------------------

/**
 * 동영상으로 볼 확장자.
 * 서버가 mediaType을 안 내려주는 옛 메시지·미배포 서버를 위한 마지막 단서다.
 */
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'avi', 'mkv', '3gp', 'wmv'];

/** 첨부를 화면에서 어떻게 그릴지 — 사진/동영상/일반 파일 */
export type ChatMediaType = 'IMAGE' | 'VIDEO' | 'FILE';

/**
 * 이 첨부를 사진으로 그릴지, 동영상 플레이어로 그릴지, 파일 줄로 그릴지 정한다.
 *
 * 저장된 `type`은 여전히 TEXT/IMAGE/FILE 뿐이고 동영상도 FILE로 들어온다 —
 * 그래서 `type === "VIDEO"` 같은 분기는 존재할 수 없고, 아래 순서로 좁혀 간다.
 */
export function chatMediaType(message: {
    type?: string;
    mediaType?: string;
    mimeType?: string;
    fileName?: string;
}): ChatMediaType {
    // 1) 서버가 이미 판단해 내려준 값이 가장 정확하다 (백엔드가 mimeType·확장자를 다 보고 정한 값).
    if (message.mediaType === 'IMAGE' || message.mediaType === 'VIDEO' || message.mediaType === 'FILE') {
        return message.mediaType;
    }

    // 2) mediaType이 없는 서버(운영 배포가 수동이라 프론트만 먼저 나가는 일이 잦다)를 위해 mimeType으로 본다.
    //    audio/*는 일부러 파일로 둔다 — 지금 화면엔 오디오 플레이어가 없다.
    const mime = message.mimeType?.toLowerCase();
    if (mime) {
        if (mime.startsWith('video/')) return 'VIDEO';
        if (mime.startsWith('image/')) return 'IMAGE';
        if (mime.startsWith('audio/')) return 'FILE';
    }

    // 3) mimeType조차 없는 옛 메시지는 파일 이름의 확장자가 마지막 단서다.
    //    이 단계 덕분에 예전에 FILE로 저장된 동영상도 뒤늦게 플레이어로 살아난다.
    const ext = message.fileName?.split('.').pop()?.toLowerCase();
    if (ext && VIDEO_EXTENSIONS.includes(ext)) return 'VIDEO';

    // 4) 아무 단서도 없으면 저장된 type을 그대로 따른다.
    return message.type === 'IMAGE' ? 'IMAGE' : 'FILE';
}
