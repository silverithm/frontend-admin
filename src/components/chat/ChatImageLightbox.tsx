"use client";

import { useEffect } from "react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Stack";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";

export interface ChatLightboxItem {
    fileUrl: string;
    fileName: string;
}

/**
 * 사진 크게 보기 — 관리자 채팅 탭과 플로팅 채팅이 같은 창을 쓴다.
 *
 * 여기서는 언제나 원본(fileUrl)을 그린다. 목록의 축소본(chatListImageUrl)을 쓰면
 * '크게 보기'가 흐릿해져 축소본을 만든 의미가 사라진다.
 * 사진 묶음에서 열면 그 묶음 전체가 items로 들어와 좌우로 넘길 수 있고,
 * 한 장짜리 사진은 items가 한 개라 지금까지와 똑같이 동작한다.
 */
export function ChatImageLightbox({
    items,
    index,
    onIndexChange,
    onClose,
    width,
    showOpenInNewTab = false,
}: {
    items: ChatLightboxItem[];
    index: number;
    onIndexChange: (next: number) => void;
    onClose: () => void;
    width: number;
    showOpenInNewTab?: boolean;
}) {
    const total = items.length;
    const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
    const current = items[safeIndex];
    const hasPrev = safeIndex > 0;
    const hasNext = safeIndex < total - 1;

    // 좌우 화살표로 넘기기. Dialog가 스스로 처리하는 ESC·포커스에는 손대지 않는다.
    useEffect(() => {
        if (total <= 1) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft" && safeIndex > 0) {
                event.preventDefault();
                onIndexChange(safeIndex - 1);
            } else if (event.key === "ArrowRight" && safeIndex < total - 1) {
                event.preventDefault();
                onIndexChange(safeIndex + 1);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [safeIndex, total, onIndexChange]);

    if (!current) return null;

    // 여러 장일 때만 '몇 번째인지'를 제목에 덧붙인다 — 한 장이면 지금까지처럼 파일 이름만 보인다
    const title = total > 1 ? `${current.fileName} (${safeIndex + 1} / ${total})` : current.fileName;

    return (
        <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} purpose="info" width={width}>
            <Layout
                header={<DialogHeader title={title} onOpenChange={(open) => { if (!open) onClose(); }} />}
                content={
                    <LayoutContent>
                        <div style={{ position: "relative" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={current.fileUrl}
                                alt={current.fileName}
                                style={{ display: "block", width: "100%", height: "auto", objectFit: "contain", borderRadius: 'var(--radius-inner)' }}
                            />
                            {total > 1 && (
                                <>
                                    <div style={{ position: "absolute", top: "50%", left: 'var(--spacing-2)', transform: "translateY(-50%)" }}>
                                        <IconButton
                                            label="이전 사진"
                                            variant="secondary"
                                            icon={<Icon icon="chevronLeft" size="md" />}
                                            isDisabled={!hasPrev}
                                            onClick={() => onIndexChange(safeIndex - 1)}
                                        />
                                    </div>
                                    <div style={{ position: "absolute", top: "50%", right: 'var(--spacing-2)', transform: "translateY(-50%)" }}>
                                        <IconButton
                                            label="다음 사진"
                                            variant="secondary"
                                            icon={<Icon icon="chevronRight" size="md" />}
                                            isDisabled={!hasNext}
                                            onClick={() => onIndexChange(safeIndex + 1)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </LayoutContent>
                }
                footer={
                    showOpenInNewTab ? (
                        <LayoutFooter hasDivider>
                            <HStack gap={2} hAlign="end">
                                <Button
                                    label="새 창에서 열기"
                                    variant="secondary"
                                    onClick={() => window.open(current.fileUrl, "_blank", "noopener")}
                                />
                                <Button label="닫기" variant="ghost" onClick={onClose} />
                            </HStack>
                        </LayoutFooter>
                    ) : undefined
                }
            />
        </Dialog>
    );
}

export default ChatImageLightbox;
