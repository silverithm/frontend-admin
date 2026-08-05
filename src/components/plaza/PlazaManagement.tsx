'use client';

import { useEffect, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Divider } from '@astryxdesign/core/Divider';
import { Badge } from '@astryxdesign/core/Badge';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import {
  IconBulb,
  IconFolder,
  IconHome2,
  IconNews,
  IconPencilPlus,
  IconShieldCheck,
  IconStar,
  IconUsersGroup,
  type TablerIcon,
} from '@tabler/icons-react';
import { MOCK_NEWS, loadNews, type NewsItem } from './newsMock';
import PlazaBoard from './PlazaBoard';
import PlazaHome, { type PlazaMenu } from './PlazaHome';
import PlazaLibrary from './PlazaLibrary';
import PlazaNews from './PlazaNews';
import { CATEGORY_META, isLoggedIn, isDemoMode, type BoardType, type PostCategory } from './plazaStore';
import { fetchPlazaRole, fetchPost } from './plazaApi';
import { useAlert } from '@/components/Alert';
import { useConfirm } from '@/components/ConfirmDialog';

const BOARD_MENUS: { key: BoardType; label: string; icon: TablerIcon; hasCategory: boolean }[] = [
  { key: 'free', label: '자유게시판', icon: IconUsersGroup, hasCategory: false },
  { key: 'review', label: '평가후기', icon: IconStar, hasCategory: true },
  { key: 'tip', label: '실무팁', icon: IconBulb, hasCategory: true },
];

const RESOURCE_MENUS: { key: PlazaMenu; label: string; icon: TablerIcon }[] = [
  { key: 'news', label: '요양 소식', icon: IconNews },
  { key: 'library', label: '자료실', icon: IconFolder },
];

const BOARD_KEYS: PlazaMenu[] = ['free', 'review', 'tip'];

/**
 * 케어브이 커뮤니티 — 카페형 레이아웃.
 * 좌측 보드 네비(데스크탑) / 상단 가로 탭(모바일) + 커뮤니티 홈·보드(평가후기·실무팁은 시설 유형 서브메뉴)·요양소식·자료실.
 */
export default function PlazaManagement() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [activeMenu, setActiveMenu] = useState<PlazaMenu>('home');
  // 평가후기·실무팁의 시설 유형 필터 (null = 해당 보드 전체)
  const [activeCategory, setActiveCategory] = useState<PostCategory | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(MOCK_NEWS);
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const [pendingWrite, setPendingWrite] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);
  // 커뮤니티 운영자 여부 — 헤더 배지 표시용 (권한 판정은 서버가 한다)
  const [isPlazaAdmin, setIsPlazaAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPlazaRole().then((role) => {
      if (!cancelled) setIsPlazaAdmin(role.isAdmin);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 외부 링크(/plaza?post=123)로 들어오면 해당 글이 속한 보드로 이동해 바로 연다.
  // useSearchParams는 Suspense 경계를 요구하므로 마운트 후 location에서 직접 읽는다.
  useEffect(() => {
    const postId = Number(new URLSearchParams(window.location.search).get('post'));
    if (Number.isFinite(postId) && postId > 0) {
      setOpenPostId(postId);
      fetchPost(postId)
        .then((post) => setActiveMenu(post.board))
        .catch(() => setActiveMenu('free'));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadNews().then((items) => {
      if (!cancelled) setNewsItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isBoardMenu = BOARD_KEYS.includes(activeMenu);

  /** 메뉴 이동 — 작성 중인 글이 있으면 이탈 확인 */
  const navigateTo = async (menu: PlazaMenu, category: PostCategory | null = null) => {
    if (menu === activeMenu && category === activeCategory) return;
    if (boardDirty) {
      const ok = await confirm({ title: '작성 취소', message: '작성 중인 내용이 사라집니다. 이동할까요?', type: 'warning', confirmText: '이동' });
      if (!ok) return;
      setBoardDirty(false);
    }
    setActiveMenu(menu);
    setActiveCategory(category);
  };

  const handleWrite = () => {
    if (!isLoggedIn()) {
      showAlert({ type: 'info', title: '로그인 필요', message: '글쓰기는 케어브이 로그인 후 이용할 수 있어요.' });
      return;
    }
    if (isDemoMode()) {
      showAlert({ type: 'info', title: '체험 모드 안내', message: '체험 모드에서는 커뮤니티에 참여할 수 없습니다.' });
      return;
    }
    if (!isBoardMenu) {
      setActiveMenu('free');
      setActiveCategory(null);
    }
    setPendingWrite(true);
  };

  const handleOpenPost = (postId: number, board: BoardType) => {
    setActiveMenu(board);
    setActiveCategory(null);
    setOpenPostId(postId);
  };

  const navButton = (menu: { key: PlazaMenu; label: string; icon: TablerIcon }) => {
    const isActive = activeMenu === menu.key && (!BOARD_KEYS.includes(menu.key) || activeCategory === null);
    return (
      <Button
        key={menu.key}
        label={menu.label}
        variant={isActive ? 'secondary' : 'ghost'}
        size="md"
        icon={<Icon icon={menu.icon} size="sm" color={isActive ? 'accent' : 'secondary'} />}
        onClick={() => navigateTo(menu.key)}
        style={{ width: '100%', justifyContent: 'flex-start' }}
      />
    );
  };

  /** 평가후기·실무팁 아래 시설 유형 서브메뉴 */
  const navSubButton = (board: BoardType, category: (typeof CATEGORY_META)[number]) => {
    const isActive = activeMenu === board && activeCategory === category.value;
    return (
      <div key={`${board}-${category.value}`} style={{ paddingLeft: 'var(--spacing-6)' }}>
        <Button
          label={category.label}
          variant={isActive ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigateTo(board, category.value)}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        />
      </div>
    );
  };

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      {/* 셸이 flex 컬럼으로 감싸므로 남은 높이를 모두 차지한다 */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: 'var(--spacing-3)' }}>
        {/* 페이지 헤더 — 운영자에게는 우측에 권한 표시 */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <VStack gap={0} align="start">
            <Heading level={2}>케어브이 커뮤니티</Heading>
            <Text type="supporting" color="secondary">전국 요양 현장의 소식·자료·이야기를 한곳에서</Text>
          </VStack>
          {isPlazaAdmin && (
            <Badge
              variant="teal"
              icon={<Icon icon={IconShieldCheck} size="xsm" />}
              label="커뮤니티 운영자"
            />
          )}
        </HStack>

        {/* 모바일: 상단 가로 스크롤 탭 — 시설 유형은 보드 안의 필터 칩으로 고른다 */}
        <div className="carev-plaza-mobiletabs scrollbar-hide">
          {[{ key: 'home' as PlazaMenu, label: '커뮤니티 홈' }, ...BOARD_MENUS, ...RESOURCE_MENUS].map((menu) => (
            <Button
              key={menu.key}
              label={menu.label}
              variant={activeMenu === menu.key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigateTo(menu.key)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            />
          ))}
          <Button label="글쓰기" variant="primary" size="sm" icon={<Icon icon={IconPencilPlus} size="xsm" />} onClick={handleWrite} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
        </div>

        {/* 카페형 레이아웃: 좌측 네비 + 메인 */}
        <div className="carev-plaza-cafe">
          {/* 좌측 보드 네비 (데스크탑) — 메인과 같은 높이로 세로를 채운다 */}
          <div className="carev-plaza-nav">
            <Card padding={2} height="100%">
              <VStack gap={1}>
                <Button
                  label="글쓰기"
                  variant="primary"
                  size="md"
                  icon={<Icon icon={IconPencilPlus} size="sm" />}
                  onClick={handleWrite}
                  style={{ width: '100%' }}
                />
                <div style={{ height: 'var(--spacing-1)' }} />
                {navButton({ key: 'home', label: '커뮤니티 홈', icon: IconHome2 })}
                {BOARD_MENUS.map((menu) => (
                  <VStack key={menu.key} gap={0.5}>
                    {navButton(menu)}
                    {menu.hasCategory && CATEGORY_META.map((category) => navSubButton(menu.key, category))}
                  </VStack>
                ))}
                <Divider />
                {RESOURCE_MENUS.map(navButton)}
              </VStack>
            </Card>
          </div>

          {/* 메인 — 데스크탑에서는 이 영역만 내부 스크롤 */}
          <div className="carev-plaza-main" style={{ minWidth: 0 }}>
            {activeMenu === 'home' && (
              <PlazaHome newsItems={newsItems} onNavigate={navigateTo} onOpenPost={handleOpenPost} />
            )}
            {isBoardMenu && (
              <PlazaBoard
                board={activeMenu as BoardType}
                category={activeCategory}
                onCategoryChange={setActiveCategory}
                openPostId={openPostId}
                onOpenPostConsumed={() => setOpenPostId(null)}
                writeRequested={pendingWrite}
                onWriteRequestConsumed={() => setPendingWrite(false)}
                onDirtyChange={setBoardDirty}
              />
            )}
            {activeMenu === 'news' && <PlazaNews newsItems={newsItems} />}
            {activeMenu === 'library' && <PlazaLibrary variant="full" />}
          </div>
        </div>
      </div>
    </>
  );
}
