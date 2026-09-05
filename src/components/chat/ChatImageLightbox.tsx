"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Stack";
import { Banner } from "@astryxdesign/core/Banner";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { chatAttachmentLabel } from "@/lib/chatMessageGrouping";
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
    const [notice, setNotice] = useState<{ status: "success" | "error"; message: string } | null>(null);
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

    // 다른 사진으로 넘어가면 지난 저장 결과 안내는 치운다
    useEffect(() => { setNotice(null); }, [safeIndex]);

    /**
     * 사진 한 장을 blob으로 받아온다.
     *
     * 사진은 S3(다른 출처)에 있어서 브라우저가 직접 fetch를 막는다(CORS). 그래서
     * 결재 첨부·서명 이미지와 똑같이 **같은 출처 프록시**로 받는다. 백엔드가 절대 S3 URL을
     * 상대 경로로 정규화해 주므로(FileAccessGuard) fileUrl을 그대로 넘기면 되고,
     * 소속 기관 검사가 있으므로 토큰을 함께 보낸다.
     *
     * 프록시가 못 받는 주소(우리 버킷이 아닌 이미지)만 원본에 직접 붙어 본다.
     */
    const fetchBlob = async (item: ChatLightboxItem): Promise<Blob> => {
        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
        const proxyUrl = `/api/v1/files/download?path=${encodeURIComponent(item.fileUrl)}`
            + `&fileName=${encodeURIComponent(item.fileName || "사진")}`;

        const res = await fetch(proxyUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) return res.blob();

        const direct = await fetch(item.fileUrl);
        if (!direct.ok) throw new Error(`사진을 받지 못했습니다 (${res.status})`);
        return direct.blob();
    };

    /** 받아온 blob을 파일로 저장시킨다 */
    const saveBlob = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || "사진";
        document.body.appendChild(a);
        a.click();
        a.remove();
        // 곧바로 되돌리면 브라우저가 아직 읽는 중인 파일이 끊길 수 있다
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    /** 보고 있는 사진 한 장 저장. 정말 안 되면 새 창으로 열어 사용자가 직접 저장하게 둔다. */
    const saveOne = async (item: ChatLightboxItem) => {
        setNotice(null);
        try {
            saveBlob(await fetchBlob(item), item.fileName);
        } catch {
            // 이 경로는 버튼을 누른 직후라 새 창이 열린다(팝업 차단에 걸리지 않는다)
            window.open(item.fileUrl, "_blank", "noopener");
        }
    };

    /**
     * 묶음을 한 번에 저장한다.
     *
     * 한꺼번에 다 밀면 브라우저가 일부를 막는다(연속 다운로드 차단). 한 장씩,
     * 사이를 조금 띄워 받는다. 한 장이 실패해도 나머지는 계속 받는다.
     *
     * 여기서는 실패해도 새 창을 열지 않는다. 반복문 안의 window.open은 첫 장만 열리고
     * 나머지는 팝업 차단에 걸려, 정작 "모두 저장"이 사진 한 장 새 창으로 끝나 버린다.
     * 실패한 장수는 화면에 알려 사용자가 그 사진만 따로 저장하게 한다.
     */
    const saveAll = async () => {
        setIsSavingAll(true);
        setNotice(null);
        let failed = 0;
        try {
            for (const item of items) {
                try {
                    saveBlob(await fetchBlob(item), item.fileName);
                } catch {
                    failed += 1;
                }
                await new Promise((r) => setTimeout(r, 250));
            }
        } finally {
            setIsSavingAll(false);
            setNotice(
                failed === 0
                    ? { status: "success", message: `${items.length}장을 저장했습니다.` }
                    : { status: "error", message: `${items.length - failed}장을 저장했고 ${failed}장은 실패했습니다. 실패한 사진은 한 장씩 저장해주세요.` },
            );
        }
    };

    if (!current) return null;

    // 제목은 사람이 읽을 이름일 때만 파일 이름을 쓴다. 앱이 압축하며 붙인
    // compressed_1757….jpg 같은 이름이 제목으로 뜨면 아무 정보도 주지 못한다.
    // (저장 파일 이름은 그대로 fileName을 쓴다 — 확장자가 필요하다.)
    const name = chatAttachmentLabel({ type: "IMAGE", fileName: current.fileName });
    const title = total > 1 ? `${name} (${safeIndex + 1} / ${total})` : name;

    return (
        <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} purpose="info" width={width}>
            <Layout
                header={<DialogHeader title={title} onOpenChange={(open) => { if (!open) onClose(); }} />}
                content={
                    <LayoutContent>
                        {notice && (
                            <div style={{ marginBottom: 'var(--spacing-3)' }}>
                                <Banner
                                    status={notice.status}
                                    title={notice.message}
                                    container="card"
                                    isDismissable
                                    onDismiss={() => setNotice(null)}
                                />
                            </div>
                        )}
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
