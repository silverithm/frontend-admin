'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Center } from '@astryxdesign/core/Center';
import { Loading } from '@/components/Loading';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { IconDownload, IconFile, IconFlag, IconFolder, IconPencil, IconTrash, IconUpload } from '@tabler/icons-react';
import { FiSearch } from 'react-icons/fi';
import { useAlert } from '@/components/Alert';
import { useConfirm } from '@/components/ConfirmDialog';
import { duration } from '@/theme/motion';
import { LIBRARY_META, REPORT_REASONS, formatFileSize, getLibraryMeta, isLoggedIn, isDemoMode, type LibraryCategory } from './plazaStore';
import {
  type ApiLibraryItem,
  deleteLibraryItem,
  downloadLibraryItem,
  fetchLibraryAccess,
  fetchLibraryItems,
  reportLibraryItem,
  updateLibraryItem,
  uploadLibraryItem,
} from './plazaApi';

type CategoryFilter = 'all' | LibraryCategory;

interface PlazaLibraryProps {
  /** full: 전체 화면(카테고리 필터·검색 툴바), compact: 커뮤니티 통합 화면의 사이드 카드 */
  variant?: 'full' | 'compact';
}

export default function PlazaLibrary({ variant = 'full' }: PlazaLibraryProps) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const isCompact = variant === 'compact';

  // 자료실 이용 자격 — 자유게시판 글 1개 이상 (null = 확인 중)
  const [access, setAccess] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [accessNoticeOpen, setAccessNoticeOpen] = useState(false);
  const [items, setItems] = useState<ApiLibraryItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 업로드 다이얼로그
  const [uploadOpen, setUploadOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<LibraryCategory>('form');
  const [formDescription, setFormDescription] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  /** 수정 중인 자료 — null이면 새로 올리는 중 */
  const [editingItem, setEditingItem] = useState<ApiLibraryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 신고 다이얼로그
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchLibraryAccess().then((result) => {
      setAccess(result);
      // 전체 화면으로 들어왔는데 자격이 없으면 이용 조건 알림창을 바로 띄운다
      if (!result.allowed && !isCompact) {
        setAccessNoticeOpen(true);
      }
    });
  }, [isCompact]);

  const loadItems = useCallback(async () => {
    if (!access?.allowed) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchLibraryItems({
        category: isCompact ? undefined : categoryFilter,
        search: debouncedSearch || undefined,
        size: 50,
      });
      setItems(data.content ?? []);
      setTotalElements(data.totalElements ?? (data.content?.length || 0));
    } catch (error) {
      console.error('[Plaza] 자료 목록 조회 실패:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, debouncedSearch, isCompact, access]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  /** 쓰기 동작 공통 가드 — 비로그인이면 로그인 안내 후 차단 */
  const requireLogin = (): boolean => {
    if (!isLoggedIn()) {
      showAlert({ type: 'info', title: '로그인 필요', message: '자료 업로드·신고는 케어브이 로그인 후 이용할 수 있어요.' });
      return false;
    }
    if (isDemoMode()) {
      showAlert({ type: 'info', title: '체험 모드 안내', message: '체험 모드에서는 커뮤니티에 참여할 수 없습니다.' });
      return false;
    }
    return true;
  };

  const openUpload = () => {
    if (!requireLogin()) return;
    setEditingItem(null);
    setFormTitle('');
    setFormCategory(categoryFilter === 'all' || isCompact ? 'form' : categoryFilter);
    setFormDescription('');
    setFormFile(null);
    setUploadOpen(true);
  };

  /** 올린 자료의 제목·분류·내용을 고친다 (파일은 그대로) */
  const openEdit = (item: ApiLibraryItem) => {
    if (!requireLogin()) return;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormCategory(item.category);
    setFormDescription(item.description ?? '');
    setFormFile(null);
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!formTitle.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '자료 제목을 입력해주세요.' });
      return;
    }
    // 수정할 때는 파일을 다시 고르지 않는다 (파일 교체는 삭제 후 재업로드)
    if (!editingItem && !formFile) {
      showAlert({ type: 'warning', title: '파일 필요', message: '업로드할 파일을 선택해주세요.' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateLibraryItem(editingItem.id, {
          category: formCategory,
          title: formTitle.trim(),
          description: formDescription.trim(),
        });
        showAlert({ type: 'success', title: '수정 완료', message: '자료 정보가 수정되었습니다.' });
      } else {
        await uploadLibraryItem({ category: formCategory, title: formTitle.trim(), description: formDescription.trim(), file: formFile! });
        showAlert({ type: 'success', title: '업로드 완료', message: '자료가 등록되었습니다.' });
      }
      setUploadOpen(false);
      loadItems();
    } catch (error) {
      showAlert({
        type: 'error',
        title: editingItem ? '수정 실패' : '업로드 실패',
        message: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (item: ApiLibraryItem) => {
    try {
      await downloadLibraryItem(item.id, item.fileName);
      loadItems();
    } catch (error) {
      showAlert({ type: 'error', title: '다운로드 실패', message: error instanceof Error ? error.message : '다운로드에 실패했습니다.' });
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: '자료 삭제', message: '이 자료를 삭제할까요?', type: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      await deleteLibraryItem(id);
      showAlert({ type: 'success', title: '삭제 완료', message: '자료가 삭제되었습니다.' });
      loadItems();
    } catch (error) {
      showAlert({ type: 'error', title: '삭제 실패', message: error instanceof Error ? error.message : '자료 삭제에 실패했습니다.' });
    }
  };

  const submitReport = async () => {
    if (!reportTargetId) return;
    try {
      const result = await reportLibraryItem(reportTargetId, reportReason);
      setReportTargetId(null);
      showAlert(
        result === 'already'
          ? { type: 'info', title: '신고 안내', message: '이미 신고한 자료입니다.' }
          : { type: 'success', title: '신고 접수', message: '신고가 접수되었습니다. 운영팀이 확인 후 조치합니다.' },
      );
      loadItems();
    } catch (error) {
      setReportTargetId(null);
      showAlert({ type: 'error', title: '신고 실패', message: error instanceof Error ? error.message : '신고 처리에 실패했습니다.' });
    }
  };

  const dialogs = (
    <>
      {/* 업로드 다이얼로그 */}
      <Dialog isOpen={uploadOpen} onOpenChange={(o) => { if (!o) setUploadOpen(false); }} purpose="form" width={520}>
        <Layout
          header={<DialogHeader title={editingItem ? '자료 수정' : '자료 올리기'} onOpenChange={(o) => { if (!o) setUploadOpen(false); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <TextInput label="자료 제목" placeholder="예: 프로그램 운영일지 양식" value={formTitle} onChange={(v) => setFormTitle(v)} />
                <Selector
                  label="카테고리"
                  value={formCategory}
                  onChange={(v) => setFormCategory((v as LibraryCategory) || 'form')}
                  options={LIBRARY_META.map((c) => ({ value: c.value, label: c.label }))}
                />
                <TextArea
                  label="내용"
                  placeholder={'자료에 대한 설명을 자유롭게 적어주세요.\n\n· 어떤 상황에 쓰는 자료인지\n· 작성 시 주의할 점\n· 참고한 지침이나 서식 출처'}
                  value={formDescription}
                  onChange={(v) => setFormDescription(v)}
                  rows={8}
                />

                {editingItem ? (
                  <Text type="supporting" color="secondary">
                    첨부 파일({editingItem.fileName})은 그대로 유지됩니다. 파일을 바꾸려면 삭제 후 다시 올려주세요.
                  </Text>
                ) : (
                <VStack gap={2} align="start">
                  <Button
                    variant="secondary"
                    size="md"
                    label={formFile ? '파일 변경' : '파일 선택'}
                    icon={<Icon icon={IconUpload} size="sm" />}
                    onClick={() => fileInputRef.current?.click()}
                  />
                  {formFile && (
                    <Text type="supporting" color="secondary">{formFile.name} · {formatFileSize(formFile.size)}</Text>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
                  />
                </VStack>
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button variant="ghost" label="취소" onClick={() => setUploadOpen(false)} />
                <Button variant="primary" label="등록" isLoading={isSubmitting} onClick={submitUpload} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 신고 다이얼로그 */}
      <Dialog isOpen={!!reportTargetId} onOpenChange={(o) => { if (!o) setReportTargetId(null); }} purpose="form" width={420}>
        <Layout
          header={<DialogHeader title="자료 신고" onOpenChange={(o) => { if (!o) setReportTargetId(null); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text type="body" color="secondary">신고 사유를 선택해주세요. 운영팀 확인 후 조치됩니다.</Text>
                <Selector
                  label="신고 사유"
                  value={reportReason}
                  onChange={(v) => setReportReason(v || REPORT_REASONS[0])}
                  options={REPORT_REASONS.map((r) => ({ value: r, label: r }))}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button variant="ghost" label="취소" onClick={() => setReportTargetId(null)} />
                <Button variant="destructive" label="신고하기" onClick={submitReport} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );

  /* 목록이 비어도 영역 안에서 가로·세로 가운데에 놓는다 (위에 붙지 않게).
     컴팩트 위젯은 부모 높이가 확정되지 않으므로 최소 높이를 줘서 가운데를 잡는다. */
  const emptyOrLoading = (
    <div style={{ height: '100%', minHeight: isCompact ? 180 : 240, padding: 'var(--spacing-4)' }}>
      <Center height="100%">
        {isLoading ? (
          <Loading size="inline" label="자료를 불러오는 중..." />
        ) : !access?.allowed ? (
          <EmptyState
            isCompact
            title="자료실 이용 조건이 있어요"
            description="자유게시판에 글을 1개 이상 작성하면 자료실이 열려요."
            icon={<Icon icon={IconFolder} size="lg" color="secondary" />}
          />
        ) : (
          <EmptyState
            isCompact
            title={debouncedSearch ? '검색 결과가 없습니다' : '등록된 자료가 없습니다'}
            description={debouncedSearch ? '다른 검색어로 시도해보세요.' : '첫 자료를 올려보세요.'}
            icon={<Icon icon={IconFolder} size="lg" color="secondary" />}
          />
        )}
      </Center>
    </div>
  );

  // ── 컴팩트(사이드 카드) 렌더 ──────────────────────────
  if (isCompact) {
    return (
      <>
        <AlertContainer />
        <ConfirmContainer />
        <Card padding={0}>
          <VStack gap={0}>
            <div style={{ padding: 'var(--spacing-3) var(--spacing-4) var(--spacing-2)' }}>
              <HStack hAlign="between" vAlign="center">
                <HStack gap={2} vAlign="center">
                  <Icon icon={IconFolder} size="sm" color="secondary" />
                  <VStack gap={0} align="start">
                    <Text type="body" weight="bold" color="primary">자료실</Text>
                    <Text type="supporting" color="secondary">{totalElements}개 자료</Text>
                  </VStack>
                </HStack>
                <Button variant="secondary" size="sm" label="올리기" icon={<Icon icon={IconUpload} size="xsm" />} onClick={openUpload} />
              </HStack>
            </div>
            <div style={{ padding: '0 var(--spacing-4) var(--spacing-2)' }}>
              <TextInput label="자료 검색" isLabelHidden placeholder="자료 검색" startIcon={FiSearch} hasClear value={search} onChange={(v) => setSearch(v)} />
            </div>
            <div style={{ padding: '0 var(--spacing-2) var(--spacing-2)', maxHeight: 400, overflowY: 'auto' }}>
              {isLoading || items.length === 0 ? emptyOrLoading : (
                <VStack gap={0}>
                  {items.map((item) => {
                    const meta = getLibraryMeta(item.category);
                    return (
                      <div
                        key={item.id}
                        className="carev-dash-row"
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', borderRadius: 'var(--radius-element)' }}
                        onClick={() => handleDownload(item)}
                      >
                        <div style={{ flexShrink: 0 }}>
                          <Badge variant={meta.badgeVariant} label={meta.label} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text as="p" type="body" weight="medium" color="primary" maxLines={1}>{item.title}</Text>
                          <Text type="supporting" color="secondary">{formatFileSize(item.fileSize)} · 다운 {item.downloadCount}</Text>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          <Icon icon={IconDownload} size="sm" color="secondary" />
                        </div>
                      </div>
                    );
                  })}
                </VStack>
              )}
            </div>
          </VStack>
        </Card>
        {dialogs}
      </>
    );
  }

  const accessNoticeMessage = access?.reason === 'LOGIN_REQUIRED'
    ? '자료실은 케어브이 로그인 후 이용할 수 있어요.'
    : '자료실은 자유게시판에 글을 1개 이상 작성한 회원만 이용할 수 있어요.\n자유게시판에 먼저 글을 남기고 다시 방문해주세요.';

  const accessNoticeDialog = (
    <Dialog isOpen={accessNoticeOpen} onOpenChange={(open) => { if (!open) setAccessNoticeOpen(false); }} purpose="info" width={420}>
      <Layout
        header={<DialogHeader title="자료실 이용 안내" onOpenChange={(open) => { if (!open) setAccessNoticeOpen(false); }} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text type="body" color="primary">
                {access?.reason === 'LOGIN_REQUIRED'
                  ? '자료실은 케어브이 로그인 후 이용할 수 있어요.'
                  : '자료실은 자유게시판에 글을 1개 이상 작성한 회원만 이용할 수 있어요.'}
              </Text>
              {access?.reason !== 'LOGIN_REQUIRED' && (
                <Text type="supporting" color="secondary">
                  받기만 하는 공간이 되지 않도록 함께 나누는 분들께 열려 있어요. 자유게시판에 첫 글을 남기면 바로 이용할 수 있습니다.
                </Text>
              )}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="확인" variant="primary" onClick={() => setAccessNoticeOpen(false)} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );

  // ── 전체 화면 렌더 ────────────────────────────────────
  if (!access?.allowed) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
        <AlertContainer />
        {accessNoticeDialog}
        <div style={{ height: '100%', minHeight: 320, padding: 'var(--spacing-4)' }}>
          <Center height="100%">
            {access === null ? (
              <Loading size="inline" label="자료실을 확인하는 중..." />
            ) : (
              <EmptyState
                title="자료실 이용 조건이 있어요"
                description={accessNoticeMessage}
                icon={<Icon icon={IconFolder} size="lg" color="secondary" />}
              />
            )}
          </Center>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.fast }} style={{ height: '100%' }}>
      <AlertContainer />
      <ConfirmContainer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', height: '100%' }}>
        {/* 툴바 */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <SegmentedControl value={categoryFilter} onChange={(v) => setCategoryFilter(v as CategoryFilter)} label="자료 카테고리" size="sm">
            <SegmentedControlItem value="all" label="전체" />
            {LIBRARY_META.map((c) => (
              <SegmentedControlItem key={c.value} value={c.value} label={c.label} />
            ))}
          </SegmentedControl>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <div style={{ width: 220 }}>
              <TextInput label="자료 검색" isLabelHidden placeholder="제목·설명·파일명 검색" startIcon={FiSearch} hasClear value={search} onChange={(v) => setSearch(v)} />
            </div>
            <Button variant="primary" size="md" label="자료 올리기" icon={<Icon icon={IconUpload} size="sm" />} onClick={openUpload} />
          </HStack>
        </HStack>

        {/* 자료 목록 — 남은 높이를 채우고 내부 스크롤 */}
        <div style={{ flex: 1, minHeight: 0 }}>
        <Card padding={0} height="100%">
          <div className="carev-plaza-scroll" style={{ height: '100%', overflowY: 'auto' }}>
          {isLoading || items.length === 0 ? emptyOrLoading : (
            <VStack gap={0}>
              {items.map((item, idx) => {
                const meta = getLibraryMeta(item.category);
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-3)',
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ flexShrink: 0, color: 'var(--color-icon-secondary)' }}>
                      <Icon icon={IconFile} size="md" color="inherit" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <VStack gap={0.5}>
                        <HStack gap={2} vAlign="center" wrap="wrap">
                          <Badge variant={meta.badgeVariant} label={meta.label} />
                          <div style={{ minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
                            <Text type="body" weight="semibold" color="primary" maxLines={1}>{item.title}</Text>
                          </div>
                        </HStack>
                        {item.description && (
                          <Text as="p" type="supporting" color="secondary" maxLines={2}>{item.description}</Text>
                        )}
                        <HStack gap={3} vAlign="center" wrap="wrap">
                          <Text type="supporting" color="secondary">{item.fileName} · {formatFileSize(item.fileSize)}</Text>
                          <Text type="supporting" color="secondary">{item.displayUploader}</Text>
                          <Text type="supporting" color="secondary">{format(new Date(item.createdAt), 'yyyy.MM.dd')}</Text>
                          <HStack gap={1} vAlign="center">
                            <Icon icon={IconDownload} size="xsm" color="secondary" />
                            <Text type="supporting" color="secondary" hasTabularNumbers>{item.downloadCount}</Text>
                          </HStack>
                        </HStack>
                      </VStack>
                    </div>
                    <HStack gap={1} vAlign="center">
                      <Button variant="secondary" size="sm" label="다운로드" icon={<Icon icon={IconDownload} size="xsm" />} onClick={() => handleDownload(item)} />
                      {item.isMine ? (
                        <>
                          <IconButton label="자료 수정" variant="ghost" size="sm" icon={<Icon icon={IconPencil} size="xsm" color="secondary" />} onClick={() => openEdit(item)} />
                          <IconButton label="자료 삭제" variant="ghost" size="sm" icon={<Icon icon={IconTrash} size="xsm" color="secondary" />} onClick={() => handleDelete(item.id)} />
                        </>
                      ) : (
                        <IconButton
                          label={item.reportedByMe ? '신고됨' : '자료 신고'}
                          variant="ghost"
                          size="sm"
                          isDisabled={item.reportedByMe}
                          icon={<Icon icon={IconFlag} size="xsm" color="secondary" />}
                          onClick={() => { if (!requireLogin()) return; setReportReason(REPORT_REASONS[0]); setReportTargetId(item.id); }}
                        />
                      )}
                    </HStack>
                  </div>
                );
              })}
            </VStack>
          )}
          </div>
        </Card>
        </div>
      </div>

      {dialogs}
    </motion.div>
  );
}
