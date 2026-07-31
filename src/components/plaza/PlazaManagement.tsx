'use client';

import { useEffect, useState } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack } from '@astryxdesign/core/Stack';
import {
  IconClipboardList,
  IconFolder,
  IconHome2,
  IconMessages,
  IconNews,
  IconPencilPlus,
  IconStar,
  IconUsersGroup,
  type TablerIcon,
} from '@tabler/icons-react';
import { MOCK_NEWS, loadNews, type NewsItem } from './newsMock';
import PlazaBoard from './PlazaBoard';
import PlazaHome, { type PlazaMenu } from './PlazaHome';
import PlazaLibrary from './PlazaLibrary';
import PlazaNews from './PlazaNews';
import { isLoggedIn, type BoardType } from './plazaStore';
import { useAlert } from '@/components/Alert';

const BOARD_MENUS: { key: PlazaMenu; label: string; icon: TablerIcon }[] = [
  { key: 'home', label: '광장 홈', icon: IconHome2 },
  { key: 'all', label: '전체글', icon: IconClipboardList },
  { key: 'qna', label: '실무 Q&A', icon: IconMessages },
  { key: 'review', label: '평가 후기', icon: IconStar },
  { key: 'free', label: '자유', icon: IconUsersGroup },
];

const RESOURCE_MENUS: { key: PlazaMenu; label: string; icon: TablerIcon }[] = [
  { key: 'news', label: '요양 소식', icon: IconNews },
  { key: 'library', label: '자료실', icon: IconFolder },
];

const BOARD_KEYS: PlazaMenu[] = ['all', 'qna', 'review', 'free'];

/**
 * 케어브이 광장 — 카페형 레이아웃.
 * 좌측 보드 네비(데스크탑) / 상단 가로 탭(모바일) + 광장 홈·보드·요양소식·자료실.
 */
export default function PlazaManagement() {
  const { showAlert, AlertContainer } = useAlert();
  const [activeMenu, setActiveMenu] = useState<PlazaMenu>('home');
  const [newsItems, setNewsItems] = useState<NewsItem[]>(MOCK_NEWS);
  const [openPostId, setOpenPostId] = useState<number | null>(null);
  const [writeSignal, setWriteSignal] = useState(0);

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

  const handleWrite = () => {
    if (!isLoggedIn()) {
      showAlert({ type: 'info', title: '로그인 필요', message: '글쓰기는 케어브이 로그인 후 이용할 수 있어요.' });
      return;
    }
    if (!isBoardMenu) {
      setActiveMenu('all');
    }
    setWriteSignal((v) => v + 1);
  };

  const handleOpenPost = (postId: number) => {
    setActiveMenu('all');
    setOpenPostId(postId);
  };

  const navButton = (menu: { key: PlazaMenu; label: string; icon: TablerIcon }) => (
    <Button
      key={menu.key}
      label={menu.label}
      variant={activeMenu === menu.key ? 'secondary' : 'ghost'}
      size="md"
      icon={<Icon icon={menu.icon} size="sm" color={activeMenu === menu.key ? 'accent' : 'secondary'} />}
      onClick={() => setActiveMenu(menu.key)}
      style={{ width: '100%', justifyContent: 'flex-start' }}
    />
  );

  return (
    <>
      <AlertContainer />
      <VStack gap={3}>
        {/* 페이지 헤더 */}
        <VStack gap={0} align="start">
          <Heading level={2}>케어브이 광장</Heading>
          <Text type="supporting" color="secondary">전국 요양 현장의 소식·자료·이야기를 한곳에서</Text>
        </VStack>

        {/* 모바일: 상단 가로 스크롤 탭 */}
        <div className="carev-plaza-mobiletabs scrollbar-hide">
          {[...BOARD_MENUS, ...RESOURCE_MENUS].map((menu) => (
            <Button
              key={menu.key}
              label={menu.label}
              variant={activeMenu === menu.key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveMenu(menu.key)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            />
          ))}
          <Button label="글쓰기" variant="primary" size="sm" icon={<Icon icon={IconPencilPlus} size="xsm" />} onClick={handleWrite} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} />
        </div>

        {/* 카페형 레이아웃: 좌측 네비 + 메인 */}
        <div className="carev-plaza-cafe">
          {/* 좌측 보드 네비 (데스크탑) */}
          <div className="carev-plaza-nav">
            <Card padding={2}>
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
                {BOARD_MENUS.map(navButton)}
                <Divider />
                {RESOURCE_MENUS.map(navButton)}
              </VStack>
            </Card>
          </div>

          {/* 메인 — 데스크탑에서는 이 영역만 내부 스크롤 */}
          <div className="carev-plaza-main" style={{ minWidth: 0 }}>
            {activeMenu === 'home' && (
              <PlazaHome newsItems={newsItems} onNavigate={setActiveMenu} onOpenPost={handleOpenPost} />
            )}
            {isBoardMenu && (
              <PlazaBoard
                board={activeMenu as 'all' | BoardType}
                openPostId={openPostId}
                onOpenPostConsumed={() => setOpenPostId(null)}
                writeSignal={writeSignal}
              />
            )}
            {activeMenu === 'news' && <PlazaNews newsItems={newsItems} />}
            {activeMenu === 'library' && <PlazaLibrary variant="full" />}
          </div>
        </div>
      </VStack>
    </>
  );
}
