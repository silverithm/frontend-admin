'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Avatar, type AvatarSize } from '@astryxdesign/core/Avatar';

import { useMemberPhoto, type PersonRef } from '@/lib/memberDirectory';

/**
 * 직원 이름 옆 프로필 사진 — 사람 번호로 기관 사진첩에서 사진을 찾는다(2026-11-16).
 *
 * 사진이 없거나 못 찾으면 Astryx Avatar가 이름 첫 글자를 그린다. 이름은 옆 글자로 이미 읽히므로
 * 사진은 화면 읽기에서 뺀다(aria-hidden). 사진 주소를 이미 알면 [imageUrl]을 넘긴다.
 */
export interface MemberAvatarProps extends PersonRef {
    name: string;
    imageUrl?: string | null;
    size?: AvatarSize;
    className?: string;
    style?: CSSProperties;
}

export default function MemberAvatar({
    name,
    id,
    type,
    email,
    imageUrl,
    size = 24,
    className,
    style,
}: MemberAvatarProps) {
    const src = useMemberPhoto({ id, type, email, name }, imageUrl);
    return (
        <span aria-hidden className={className} style={{ display: 'inline-flex', flexShrink: 0, ...style }}>
            {/* 사진 주소가 바뀌면 새로 그린다 — Avatar는 한 번 깨진 사진을 기억해 다음 사진도 안 그린다 */}
            <Avatar key={src ?? 'none'} name={name} src={src ?? undefined} size={size} />
        </span>
    );
}

/** 사진 + 이름(+ '담당' 같은 옅은 꼬리 글자) 한 덩어리 */
export function MemberName({
    name,
    suffix,
    size = 20,
    children,
    ...ref
}: PersonRef & { name: string; suffix?: string; size?: AvatarSize; children?: ReactNode }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <MemberAvatar name={name} size={size} {...ref} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{name}</span>
                {suffix ? (
                    <span style={{ color: 'var(--color-text-secondary)' }}> {suffix}</span>
                ) : null}
            </span>
            {children}
        </span>
    );
}

/** 사진을 조금씩 겹쳐 [max]명까지, 넘치면 '+n' */
export function MemberFaces({
    people,
    size = 24,
    max = 3,
}: {
    people: (PersonRef & { name: string; imageUrl?: string | null })[];
    size?: 20 | 24 | 32;
    max?: number;
}) {
    const shown = people.slice(0, max);
    const more = people.length - shown.length;
    const overlap = Math.round(size * 0.32);
    return (
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
            {shown.map((p, i) => (
                <span
                    key={`${p.id ?? p.email ?? p.name}-${i}`}
                    style={{
                        display: 'inline-flex',
                        marginLeft: i === 0 ? 0 : -overlap,
                        borderRadius: '50%',
                        boxShadow: '0 0 0 2px var(--color-background-card)',
                    }}
                >
                    <MemberAvatar name={p.name} id={p.id} type={p.type} email={p.email} imageUrl={p.imageUrl} size={size} />
                </span>
            ))}
            {more > 0 ? (
                <span
                    style={{
                        marginLeft: -overlap,
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: Math.max(10, Math.round(size * 0.4)),
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-background-muted)',
                        boxShadow: '0 0 0 2px var(--color-background-card)',
                    }}
                >
                    +{more}
                </span>
            ) : null}
        </span>
    );
}
