'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Card } from '@astryxdesign/core/Card';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { Selector } from '@astryxdesign/core/Selector';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Loading } from '@/components/Loading';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import { useConfirm } from '@/components/ConfirmDialog';
import { FiFolder, FiPlus, FiTrash2, FiDownload, FiEye, FiUploadCloud, FiFileText } from 'react-icons/fi';
import {
  fetchCompanyLibrary,
  createCompanyLibraryItem,
  deleteCompanyLibraryItem,
  uploadFileToServer,
} from '@/lib/apiService';

interface CompanyLibraryProps {
  isAdmin?: boolean;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface LibraryItem {
  id: number;
  category?: string | null;
  title: string;
  description?: string | null;
  fileName: string;
  fileSize: number;
  filePath: string;
  uploaderName?: string | null;
  createdAt: string;
}

/** 기관이 흔히 쓰는 분류 — 직접 입력으로 새 분류를 만들 수도 있다 */
const DEFAULT_CATEGORIES = ['서식', '매뉴얼', '교육자료', '규정', '기타'];
const NEW_CATEGORY_VALUE = '__new__';
const UNCATEGORIZED = '미분류';

/** 화면 안에서 바로 열 수 있는 문서 (그 외는 내려받기) */
const VIEWABLE_EXTENSIONS = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'png', 'jpg', 'jpeg', 'gif'];

const isViewable = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return !!ext && VIEWABLE_EXTENSIONS.includes(ext);
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/**
 * 기관 전용 자료실.
 *
 * 커뮤니티(광장) 자료실은 전체 기관이 함께 쓰지만 여기는 우리 기관 안에서만 보인다.
 * 근무 매뉴얼·서식처럼 밖으로 나가면 안 되는 자료를 두는 곳.
 */
export default function CompanyLibrary({ isAdmin = true, onNotification }: CompanyLibraryProps) {
  const { confirm, ConfirmContainer } = useConfirm();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: '' });
  const [customCategory, setCustomCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewerFile, setViewerFile] = useState<{ fileUrl: string; fileName: string } | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetchCompanyLibrary();
      setItems(response.items || []);
    } catch (error) {
      console.error('자료실 로드 실패:', error);
      onNotification('자료를 불러오지 못했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const categories = useMemo(() => {
    const used = items.map((i) => (i.category || '').trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...used]));
  }, [items]);

  const usedCategories = useMemo(
    () => Array.from(new Set(items.map((i) => (i.category || '').trim()).filter(Boolean))),
    [items],
  );

  const hasUncategorized = useMemo(() => items.some((i) => !(i.category || '').trim()), [items]);

  const visibleItems = useMemo(() => {
    if (!categoryFilter) return items;
    if (categoryFilter === UNCATEGORIZED) return items.filter((i) => !(i.category || '').trim());
    return items.filter((i) => (i.category || '').trim() === categoryFilter);
  }, [items, categoryFilter]);

  const closeUpload = () => {
    setShowUpload(false);
    setForm({ title: '', description: '', category: '' });
    setCustomCategory('');
    setFile(null);
  };

  const handleUpload = async () => {
    if (!form.title.trim() || !file) {
      onNotification('제목과 파일을 모두 입력해주세요', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const uploaded = await uploadFileToServer(file, { category: 'attachments' });
      const category = (form.category === NEW_CATEGORY_VALUE ? customCategory : form.category).trim();

      await createCompanyLibraryItem({
        title: form.title.trim(),
        description: form.description.trim(),
        category,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        filePath: uploaded.filePath,
        uploaderId: typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : '',
        uploaderName: typeof window !== 'undefined' ? localStorage.getItem('userName') || '' : '',
      });

      onNotification('자료를 올렸습니다', 'success');
      closeUpload();
      loadItems();
    } catch (error) {
      console.error('자료 등록 실패:', error);
      onNotification('자료 등록에 실패했습니다', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    const confirmed = await confirm({
      title: '자료 삭제',
      message: `"${item.title}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteCompanyLibraryItem(item.id);
      onNotification('자료를 삭제했습니다', 'success');
      loadItems();
    } catch (error) {
      console.error('자료 삭제 실패:', error);
      onNotification('삭제에 실패했습니다', 'error');
    }
  };

  const handleDownload = async (item: LibraryItem) => {
    try {
      const token = localStorage.getItem('authToken');
      const url = `/api/v1/files/download?path=${encodeURIComponent(item.filePath)}&fileName=${encodeURIComponent(item.fileName)}`;
      const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('다운로드 실패');

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = item.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('다운로드 실패:', error);
      onNotification('다운로드에 실패했습니다', 'error');
    }
  };

  return (
    <>
      <ConfirmContainer />
      <VStack gap={5}>
        <HStack hAlign="between" vAlign="center">
          <VStack gap={1}>
            <Text as="h2" type="display-3" weight="bold">기관 자료실</Text>
            <Text type="supporting" color="secondary">
              우리 기관 직원만 보는 문서함입니다. 근무 매뉴얼·서식·교육자료를 올려두고 함께 쓰세요.
            </Text>
          </VStack>
          {isAdmin && (
            <Button
              label="자료 올리기"
              variant="primary"
              icon={<Icon icon={FiPlus} size="sm" />}
              onClick={() => setShowUpload(true)}
            />
          )}
        </HStack>

        {/* 분류 필터 */}
        {!isLoading && (usedCategories.length > 0 || hasUncategorized) && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Icon icon={FiFolder} size="sm" color="secondary" />
            <Button
              label={`전체 (${items.length})`}
              variant={categoryFilter === '' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('')}
            />
            {usedCategories.map((category) => (
              <Button
                key={category}
                label={`${category} (${items.filter((i) => (i.category || '').trim() === category).length})`}
                variant={categoryFilter === category ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(category)}
              />
            ))}
            {hasUncategorized && (
              <Button
                label={`${UNCATEGORIZED} (${items.filter((i) => !(i.category || '').trim()).length})`}
                variant={categoryFilter === UNCATEGORIZED ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(UNCATEGORIZED)}
              />
            )}
          </HStack>
        )}

        {isLoading ? (
          <Loading label="자료를 불러오는 중..." />
        ) : visibleItems.length === 0 ? (
          <Card padding={10}>
            <EmptyState
              icon={<Icon icon={FiFileText} size="lg" color="tertiary" />}
              title={items.length === 0 ? '올려둔 자료가 없습니다' : '이 분류에 자료가 없습니다'}
              description={items.length === 0 ? '자주 쓰는 서식이나 매뉴얼을 올려두면 직원들이 바로 받아볼 수 있어요.' : undefined}
              actions={
                items.length > 0
                  ? <Button label="전체 보기" variant="secondary" size="sm" onClick={() => setCategoryFilter('')} />
                  : undefined
              }
            />
          </Card>
        ) : (
          <VStack gap={3}>
            {visibleItems.map((item) => (
              <Card key={item.id}>
                <HStack hAlign="between" vAlign="center" gap={4}>
                  <HStack gap={3} vAlign="start">
                    <Icon icon={FiFileText} size="lg" color="secondary" />
                    <VStack gap={1}>
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="semibold" color="primary">{item.title}</Text>
                        {(item.category || '').trim() && <Badge variant="blue" label={(item.category || '').trim()} />}
                      </HStack>
                      {item.description && (
                        <Text type="supporting" color="secondary">{item.description}</Text>
                      )}
                      <Text type="supporting" color="disabled">
                        {item.fileName}
                        {formatFileSize(item.fileSize) ? ` (${formatFileSize(item.fileSize)})` : ''}
                        {item.uploaderName ? ` · ${item.uploaderName}` : ''}
                        {item.createdAt ? ` · ${format(new Date(item.createdAt), 'yyyy.MM.dd', { locale: ko })}` : ''}
                      </Text>
                    </VStack>
                  </HStack>
                  <HStack gap={2} vAlign="center">
                    {isViewable(item.fileName) && (
                      <Button
                        label="바로 보기"
                        variant="secondary"
                        size="sm"
                        icon={<Icon icon={FiEye} size="sm" />}
                        onClick={() => setViewerFile({ fileUrl: item.filePath, fileName: item.fileName })}
                      />
                    )}
                    <Button
                      label="받기"
                      variant="ghost"
                      size="sm"
                      icon={<Icon icon={FiDownload} size="sm" />}
                      onClick={() => handleDownload(item)}
                    />
                    {isAdmin && (
                      <IconButton
                        label="삭제"
                        tooltip="삭제"
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon={FiTrash2} size="sm" />}
                        onClick={() => handleDelete(item)}
                      />
                    )}
                  </HStack>
                </HStack>
              </Card>
            ))}
          </VStack>
        )}
      </VStack>

      {/* 자료 올리기 */}
      <Dialog isOpen={showUpload} onOpenChange={(open) => { if (!open) closeUpload(); }} purpose="form" width={520}>
        <Layout
          header={<DialogHeader title="자료 올리기" onOpenChange={(open) => { if (!open) closeUpload(); }} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <TextInput
                  label="제목"
                  isRequired
                  value={form.title}
                  onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
                  placeholder="예: 2026년 근무 매뉴얼"
                />
                <TextArea
                  label="설명"
                  isOptional
                  rows={2}
                  value={form.description}
                  onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                  placeholder="어떤 자료인지 간단히 적어주세요"
                />
                <VStack gap={2}>
                  <Selector
                    label="분류"
                    placeholder="분류를 선택하세요 (선택 안 하면 미분류)"
                    value={form.category}
                    options={[
                      ...categories.map((c) => ({ value: c, label: c })),
                      { value: NEW_CATEGORY_VALUE, label: '+ 새 분류 직접 입력' },
                    ]}
                    hasClear
                    onChange={(value) => {
                      setForm((prev) => ({ ...prev, category: value || '' }));
                      if (value !== NEW_CATEGORY_VALUE) setCustomCategory('');
                    }}
                  />
                  {form.category === NEW_CATEGORY_VALUE && (
                    <TextInput
                      label="새 분류 이름"
                      value={customCategory}
                      onChange={setCustomCategory}
                      placeholder="예: 안전점검"
                    />
                  )}
                </VStack>

                <VStack gap={2}>
                  <Text type="label">파일 *</Text>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-6)',
                      border: '2px dashed var(--color-border)',
                      borderRadius: 'var(--radius-inner)',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {file ? (
                      <HStack gap={3} hAlign="center" vAlign="center">
                        <Icon icon={FiFileText} size="lg" color="accent" />
                        <VStack gap={0.5}>
                          <Text weight="semibold">{file.name}</Text>
                          <Text type="supporting">{formatFileSize(file.size)}</Text>
                        </VStack>
                      </HStack>
                    ) : (
                      <VStack gap={1} hAlign="center">
                        <FiUploadCloud size={32} style={{ color: 'var(--color-icon-tertiary, #94a3b8)' }} />
                        <Text color="secondary">클릭하여 파일 선택</Text>
                        <Text type="supporting">한글·워드·엑셀·PDF·이미지</Text>
                      </VStack>
                    )}
                  </div>
                </VStack>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="ghost" onClick={closeUpload} isDisabled={isSaving} />
                <Button
                  label="올리기"
                  variant="primary"
                  isLoading={isSaving}
                  isDisabled={isSaving || !form.title.trim() || !file}
                  onClick={handleUpload}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {viewerFile && (
        <DocumentViewerModal
          fileUrl={viewerFile.fileUrl}
          fileName={viewerFile.fileName}
          onClose={() => setViewerFile(null)}
        />
      )}
    </>
  );
}
