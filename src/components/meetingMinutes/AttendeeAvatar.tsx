'use client';

import { FiCheck } from 'react-icons/fi';

import MemberAvatar from '@/components/MemberAvatar';
import type { MeetingMinutesAttendee } from '@/types/meetingMinutes';

/**
 * 회의록 참석자 서명 카드의 프로필 사진 — 서명 완료면 오른쪽 아래에 작은 체크,
 * 아직이면 사진을 흐리게 해서 서명 상태가 사진으로도 읽히게 한다.
 */
export default function AttendeeAvatar({ attendee, size = 36 }: { attendee: MeetingMinutesAttendee; size?: 32 | 36 | 40 }) {
    const signed = !!attendee.signedAt;
    const badge = Math.round(size * 0.4);
    return (
        <span aria-hidden style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <span style={{ display: 'inline-flex', opacity: signed ? 1 : 0.5 }}>
                <MemberAvatar
                    name={attendee.attendeeName}
                    id={attendee.refId}
                    type={attendee.attendeeType}
                    size={size}
                />
            </span>
            {signed ? (
                <span
                    style={{
                        position: 'absolute',
                        right: -2,
                        bottom: -2,
                        width: badge,
                        height: badge,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-accent)',
                        color: 'var(--color-on-accent)',
                        boxShadow: '0 0 0 2px var(--color-background-card)',
                    }}
                >
                    <FiCheck size={Math.round(badge * 0.7)} />
                </span>
            ) : null}
        </span>
    );
}
