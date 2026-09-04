"use client";

import { useEffect, useState } from "react";
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
    const [isSavingAll, setIsSavingAll] = useState(false);
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

    /**
     * 사진 저장. 브라우저가 같은 출처가 아닌 이미지를 <a download>로 저장하지 못하므로
     * 내려받아 blob으로 만들어 저장한다. 실패하면 새 창으로 열어 사용자가 직접 저장하게 둔다.
     */
    const saveOne = async (item: ChatLightboxItem) => {
        try {
            const res = await fetch(item.fileUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = item.fileName || "사진";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch {
            window.open(item.fileUrl, "_blank", "noopener");
        }
    };

    /**
     * 묶음을 한 번에 저장한다.
     *
     * 한꺼번에 다 밀면 브라우저가 일부를 막는다(연속 다운로드 차단). 한 장씩,
     * 사이를 조금 띄워 받는다. 한 장이 실패해도 나머지는 계속 받는다.
     */
    const saveAll = async () => {
        setIsSavingAll(true);
        try {
            for (const item of items) {
                await saveOne(item);
                await new Promise((r) => setTimeout(r, 250));
            }
        } finally {
            setIsSavingAll(false);
        }
    };

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
                    <LayoutFooter hasDivider>
                        <HStack gap={2} hAlign="end" wrap="wrap">
                            {/* 여러 장일 때만 — 한 장짜리에 '모두 저장'은 같은 버튼이 둘인 셈이다.
                                서른 장을 한 장씩 누르게 두면 기능이 있으나 마나다. */}
                            {total > 1 && (
                                <Button
                                    label={`${total}장 모두 저장`}
                                    variant="secondary"
                                    isLoading={isSavingAll}
                                    isDisabled={isSavingAll}
                                    onClick={saveAll}
                                />
                            )}
                            <Button
                                label="이 사진 저장"
                                variant="secondary"
                                onClick={() => saveOne(current)}
                            />
                            {showOpenInNewTab && (
                                <Button
                                    label="새 창에서 열기"
                                    variant="secondary"
                                    onClick={() => window.open(current.fileUrl, "_blank", "noopener")}
                                />
                            )}
                            <Button label="닫기" variant="ghost" onClick={onClose} />
                        </HStack>
                    </LayoutFooter>
                }
            />
        </Dialog>
    );
}

export default ChatImageLightbox;
