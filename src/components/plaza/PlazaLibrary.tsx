'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { EmptyState } from '@astryxdesign/core/EmptyState';
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
import {
  LIBRARY_META,
  REPORT_REASONS,
  type LibraryCategory,
  addLibraryItem,
  deleteLibraryItem,
  formatFileSize,
  getCurrentUser,
  getLibraryItems,
  getLibraryMeta,
  getSessionFile,
  incrementDownload,
  reportLibraryItem,
} from './plazaStore';

type CategoryFilter = 'all' | LibraryCategory;

export default function PlazaLibrary() {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const user = getCurrentUser();

  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  // 업로드 다이얼로그
  const [uploadOpen, setUploadOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<LibraryCategory>('form');
  const [formDescription, setFormDescription] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 신고 다이얼로그
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);

  const allItems = useMemo(() => getLibraryItems(), [version]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q) && !item.fileName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allItems, categoryFilter, search]);

  const openUpload = () => {
    setFormTitle('');
    setFormCategory(categoryFilter === 'all' ? 'form' : categoryFilter);
    setFormDescription('');
    setFormFile(null);
    setUploadOpen(true);
  };

  const submitUpload = () => {
    if (!formTitle.trim()) {
      showAlert({ type: 'warning', title: '입력 필요', message: '자료 제목을 입력해주세요.' });
      return;
    }
    if (!formFile) {
      showAlert({ type: 'warning', title: '파일 필요', message: '업로드할 파일을 선택해주세요.' });
      return;
    }
    addLibraryItem({ category: formCategory, title: formTitle.trim(), description: formDescription.trim(), file: formFile });
    setUploadOpen(false);
    showAlert({ type: 'success', title: '업로드 완료', message: '자료가 등록되었습니다.' });
    refresh();
  };

  const handleDownload = (id: string) => {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;
    incrementDownload(id);
    const file = getSessionFile(id);
    if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // 시드/이전 세션 자료는 메타만 있음 — 실제 파일은 백엔드 연동 후 제공
      showAlert({ type: 'info', title: '다운로드 준비 중', message: '목업 단계 자료입니다. 실제 파일 다운로드는 서버 연동 후 제공됩니다.' });
    }
    refresh();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: '자료 삭제', message: '이 자료를 삭제할까요?', type: 'danger', confirmText: '삭제' });
    if (!ok) return;
    deleteLibraryItem(id);
    showAlert({ type: 'success', title: '삭제 완료', message: '자료가 삭제되었습니다.' });
    refresh();
  };

  const submitReport = () => {
    if (!reportTargetId) return;
    const result = reportLibraryItem(reportTargetId, reportReason);
    setReportTargetId(null);
    showAlert(
      result === 'already'
        ? { type: 'info', title: '신고 안내', message: '이미 신고한 자료입니다.' }
        : { type: 'success', title: '신고 접수', message: '신고가 접수되었습니다. 운영팀이 확인 후 조치합니다.' },
    );
    refresh();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <AlertContainer />
      <ConfirmContainer />

      <VStack gap={3}>
        {/* 툴바 */}
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <SegmentedControl value={categoryFilter} onChange={(v) => setCategoryFilter(v as CategoryFilter)} label="자료 카테고리" size="sm">
            <SegmentedControlItem value="all" label={`전체 (${allItems.length})`} />
            {LIBRARY_META.map((c) => (
              <SegmentedControlItem key={c.value} value={c.value} label={`${c.label} (${allItems.filter((i) => i.category === c.value).length})`} />
            ))}
          </SegmentedControl>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <div style={{ width: 220 }}>
              <TextInput label="자료 검색" isLabelHidden placeholder="제목·설명·파일명 검색" startIcon={FiSearch} hasClear value={search} onChange={(v) => setSearch(v)} />
            </div>
            <Button variant="primary" size="md" label="자료 올리기" icon={<Icon icon={IconUpload} size="sm" />} onClick={openUpload} />
          </HStack>
        </HStack>

        {/* 자료 목록 */}
        <Card padding={0}>
          {visibleItems.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)' }}>
              <EmptyState
                isCompact
                title={search ? '검색 결과가 없습니다' : '등록된 자료가 없습니다'}
                description={search ? '다른 검색어로 시도해보세요.' : '첫 자료를 올려보세요.'}
                icon={<Icon icon={IconFolder} size="lg" color="secondary" />}
              />
            </div>
          ) : (
            <VStack gap={0}>
              {visibleItems.map((item, idx) => {
                const meta = getLibraryMeta(item.category);
                const isMine = item.uploaderId === user.id;
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
                          <Text type="body" weight="semibold" color="primary" maxLines={1}>{item.title}</Text>
                        </HStack>
                        {item.description && (
                          <Text as="p" type="supporting" color="secondary" maxLines={1}>{item.description}</Text>
                        )}
                        <HStack gap={3} vAlign="center" wrap="wrap">
                          <Text type="supporting" color="secondary">{item.fileName} · {formatFileSize(item.fileSize)}</Text>
                          <Text type="supporting" color="secondary">{item.companyName} · {item.uploaderName}</Text>
                          <Text type="supporting" color="secondary">{format(new Date(item.createdAt), 'yyyy.MM.dd')}</Text>
                          <HStack gap={1} vAlign="center">
                            <Icon icon={IconDownload} size="xsm" color="secondary" />
                            <Text type="supporting" color="secondary" hasTabularNumbers>{item.downloadCount}</Text>
                          </HStack>
                        </HStack>
                      </VStack>
                    </div>
                    <HStack gap={1} vAlign="center">
                      <Button variant="secondary" size="sm" label="다운로드" icon={<Icon icon={IconDownload} size="xsm" />} onClick={() => handleDownload(item.id)} />
                      {isMine ? (
                        <IconButton label="자료 삭제" variant="ghost" size="sm" icon={<Icon icon={IconTrash} size="xsm" color="secondary" />} onClick={() => handleDelete(item.id)} />
                      ) : (
                        <IconButton
                          label={item.reportedBy.includes(user.id) ? '신고됨' : '자료 신고'}
                          variant="ghost"
                          size="sm"
                          isDisabled={item.reportedBy.includes(user.id)}
                          icon={<Icon icon={IconFlag} size="xsm" color="secondary" />}
                          onClick={() => { setReportReason(REPORT_REASONS[0]); setReportTargetId(item.id); }}
                        />
                      )}
                    </HStack>
                  </div>
                );
              })}
            </VStack>
          )}
        </Card>
      </VStack>

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
                <Button variant="primary" label="등록" onClick={submitUpload} />
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
    </motion.div>
  );
}
