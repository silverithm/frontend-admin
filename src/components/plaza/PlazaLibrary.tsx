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
import { Spinner } from '@astryxdesign/core/Spinner';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { IconDownload, IconFile, IconFlag, IconFolder, IconTrash, IconUpload } from '@tabler/icons-react';
import { FiSearch } from 'react-icons/fi';
import { useAlert } from '@/components/Alert';
import { useConfirm } from '@/components/ConfirmDialog';
import { duration } from '@/theme/motion';
import { LIBRARY_META, REPORT_REASONS, formatFileSize, getLibraryMeta, isLoggedIn, type LibraryCategory } from './plazaStore';
import {
  type ApiLibraryItem,
  deleteLibraryItem,
  downloadLibraryItem,
  fetchLibraryItems,
  reportLibraryItem,
  uploadLibraryItem,
} from './plazaApi';

type CategoryFilter = 'all' | LibraryCategory;

interface PlazaLibraryProps {
  /** full: 전체 화면(카테고리 필터·검색 툴바), compact: 광장 통합 화면의 사이드 카드 */
  variant?: 'full' | 'compact';
}

export default function PlazaLibrary({ variant = 'full' }: PlazaLibraryProps) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const isCompact = variant === 'compact';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 신고 다이얼로그
  const [reportTargetId, setReportTargetId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadItems = useCallback(async () => {
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
  }, [categoryFilter, debouncedSearch, isCompact]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  /** 쓰기 동작 공통 가드 — 비로그인이면 로그인 안내 후 차단 */
  const requireLogin = (): boolean => {
    if (isLoggedIn()) return true;
    showAlert({ type: 'info', title: '로그인 필요', message: '자료 업로드·신고는 케어브이 로그인 후 이용할 수 있어요.' });
    return false;
  };

  const openUpload = () => {
    if (!requireLogin()) return;
    setFormTitle('');
    setFormCategory(categoryFilter === 'all' || isCompact ? 'form' : categoryFilter);
    setFormDescription('');
    setFormFile(null);
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!formTitle.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '자료 제목을 입력해주세요.' });
      return;
    }
    if (!formFile) {
      showAlert({ type: 'warning', title: '파일 필요', message: '업로드할 파일을 선택해주세요.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await uploadLibraryItem({ category: formCategory, title: formTitle.trim(), description: formDescription.trim(), file: formFile });
      setUploadOpen(false);
      showAlert({ type: 'success', title: '업로드 완료', message: '자료가 등록되었습니다.' });
      loadItems();
    } catch (error) {
      showAlert({ type: 'error', title: '업로드 실패', message: error instanceof Error ? error.message : '자료 업로드에 실패했습니다.' });
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
          header={<DialogHeader title="자료 올리기" onOpenChange={(o) => { if (!o) setUploadOpen(false); }} />}
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
                <TextArea label="설명" placeholder="자료에 대한 간단한 설명을 입력하세요" value={formDescription} onChange={(v) => setFormDescription(v)} rows={3} />

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

  const emptyOrLoading = isLoading ? (
    <div style={{ padding: 'var(--spacing-6)', display: 'flex', justifyContent: 'center' }}>
      <Spinner size="sm" label="불러오는 중..." />
    </div>
  ) : (
    <div style={{ padding: isCompact ? 'var(--spacing-4)' : 'var(--spacing-8)' }}>
      <EmptyState
        isCompact
        title={debouncedSearch ? '검색 결과가 없습니다' : '등록된 자료가 없습니다'}
        description={debouncedSearch ? '다른 검색어로 시도해보세요.' : '첫 자료를 올려보세요.'}
        icon={<Icon icon={IconFolder} size="lg" color="secondary" />}
      />
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

  // ── 전체 화면 렌더 ────────────────────────────────────
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
          <div style={{ height: '100%', overflowY: 'auto' }}>
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
                          <Text as="p" type="supporting" color="secondary" maxLines={1}>{item.description}</Text>
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
                        <IconButton label="자료 삭제" variant="ghost" size="sm" icon={<Icon icon={IconTrash} size="xsm" color="secondary" />} onClick={() => handleDelete(item.id)} />
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
