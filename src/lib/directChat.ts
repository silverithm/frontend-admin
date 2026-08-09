import { createChatRoom } from '@/lib/apiService';

/**
 * 1:1 대화 공용 규칙.
 *
 * 채팅 페이지(ChatManagement)와 플로팅 채팅이 같은 방을 써야 하므로 이름 규칙과
 * 생성 절차를 한 곳에 둔다. 양쪽에 복사해두면 한쪽만 고쳤을 때 같은 상대와의 방이
 * 두 개 생긴다.
 */

/** 방 이름 규칙 — 같은 상대와 두 번 만들지 않으려면 이름이 일정해야 한다 */
export function directRoomName(memberName: string): string {
    return `${memberName} 님과의 대화`;
}

export interface DirectChatMember {
    id: string;
    name: string;
    position?: string | null;
    profileImageUrl?: string | null;
}

/** 방 목록에서 1:1 여부를 판별하는 데 필요한 최소 형태 */
interface DirectRoomCandidate {
    id: number;
    name: string;
    participantCount: number;
}

/**
 * 상대와의 1:1 방을 연다. 이미 있으면 그 방을 쓰고, 없을 때만 만든다 —
 * 매번 새 방이 생기면 대화가 흩어져 쓸모가 없어진다.
 * 판별은 '나와 상대 둘만 있는 방' 기준.
 */
export async function openOrCreateDirectRoom<T extends DirectRoomCandidate>(params: {
    rooms: T[];
    member: DirectChatMember;
    userId: string;
    userName: string;
}): Promise<{ roomId: number | null; isNew: boolean }> {
    const { rooms, member, userId, userName } = params;
    const wantedName = directRoomName(member.name);

    const existing = rooms.find(r => r.participantCount === 2 && r.name === wantedName);
    if (existing) return { roomId: existing.id, isNew: false };

    const response = await createChatRoom({
        name: wantedName,
        description: '1:1 대화',
        creatorId: userId,
        creatorName: userName,
        // 백엔드는 생성자를 자동 포함하지 않으므로 나도 참가자에 넣어야 한다
        participantIds: [userId, member.id],
    });

    const created = response.room || response;
    return { roomId: created?.id ?? null, isNew: true };
}
