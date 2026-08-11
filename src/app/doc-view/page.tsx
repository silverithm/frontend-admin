'use client';

/**
 * 앱(WebView)용 문서 뷰어 페이지.
 *
 * 모바일 앱에는 워드·엑셀·슬라이드를 그릴 방법이 없어, 관리자 웹과 같은 뷰어를
 * 앱 안의 WebView로 띄운다. 파일 내용이 외부 문서 뷰어 서비스로 나가지 않고
 * 우리 서버·브라우저 안에서만 처리된다.
 *
 * 인증: 토큰을 주소에 담지 않는다. 앱이 화면을 띄운 뒤
 * `window.carevSetAuthToken('...')`를 호출해 넣어준다.
 * (브라우저에서 그냥 열었을 땐 이미 로그인된 localStorage 토큰을 쓴다)
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Text } from '@astryxdesign/core/Text';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import { Loading } from '@/components/Loading';

declare global {
    interface Window {
        carevSetAuthToken?: (token: string) => void;
        /** 앱이 등록하는 JS 채널 — 닫기를 눌렀을 때 화면을 내리라고 알린다 */
        CarevViewerBridge?: { postMessage: (message: string) => void };
    }
}

function DocViewInner() {
    const params = useSearchParams();
    const path = params.get('path') || '';
    const fileName = params.get('name') || '문서';
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        // 앱이 토큰을 넣어주기 전이라도, 웹에서 열었다면 기존 로그인 토큰을 그대로 쓴다
        if (localStorage.getItem('authToken')) {
            setIsAuthReady(true);
        }
        window.carevSetAuthToken = (token: string) => {
            localStorage.setItem('authToken', token);
            setIsAuthReady(true);
        };
        return () => {
            delete window.carevSetAuthToken;
        };
    }, []);

    const close = () => {
        if (window.CarevViewerBridge) {
            window.CarevViewerBridge.postMessage('close');
            return;
        }
        window.close();
    };

    if (!path) {
        return (
            <div style={{ padding: 'var(--spacing-6)' }}>
                <Text type="body" color="secondary">열 파일이 지정되지 않았습니다.</Text>
            </div>
        );
    }

    if (!isAuthReady) {
        return <Loading height="100vh" label="문서를 준비하는 중..." />;
    }

    return <DocumentViewerModal fileUrl={path} fileName={fileName} onClose={close} />;
}

export default function DocViewPage() {
    return (
        <Suspense fallback={<Loading height="100vh" label="문서를 준비하는 중..." />}>
            <DocViewInner />
        </Suspense>
    );
}
