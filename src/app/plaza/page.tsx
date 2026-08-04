'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import Navbar from '@/components/Navbar';
import PlazaManagement from '@/components/plaza/PlazaManagement';
import { isLoggedIn } from '@/components/plaza/plazaStore';

/**
 * 케어브이 커뮤니티 — 로그인 없이 접근 가능한 공개 커뮤니티 페이지.
 * 읽기(뉴스·게시글·자료 목록)는 누구나, 쓰기(글·댓글·좋아요·업로드)는 로그인 후 가능.
 * 관리자/직원 셸과 같은 확정 높이(100dvh) flex 셸이라 커뮤니티가 화면을 블록으로 채운다.
 */
export default function PlazaPage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(true); // SSR/첫 렌더에서는 배너 숨김

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  return (
    <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--color-background-surface)' }}>
      <Navbar />

      {/* 남은 높이를 커뮤니티가 채우고, 좁은 화면에서 넘치면 이 래퍼가 스크롤 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-4)',
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--spacing-6) var(--spacing-4)',
        }}
      >
        {!loggedIn && (
          <Banner
            status="info"
            container="section"
            title="둘러보기는 자유, 참여는 로그인 후에"
            description="뉴스·게시글·자료는 누구나 볼 수 있어요. 글쓰기, 댓글, 좋아요, 자료 업로드는 케어브이 로그인 후 이용할 수 있습니다."
            endContent={<Button variant="primary" size="sm" label="로그인" onClick={() => router.push('/login')} />}
          />
        )}
        <PlazaManagement />
      </div>
    </main>
  );
}
