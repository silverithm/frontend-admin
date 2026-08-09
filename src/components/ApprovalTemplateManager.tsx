'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getApprovalTemplates, createApprovalTemplate, updateApprovalTemplate, toggleApprovalTemplateActive, deleteApprovalTemplate, getApproverCandidates } from '@/lib/apiService';
import { ApprovalTemplate } from '@/types/approvalTemplate';
import { FormSchema } from '@/types/formSchema';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Card } from '@astryxdesign/core/Card';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import { Loading } from '@/components/Loading';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Selector } from '@astryxdesign/core/Selector';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Table, TableRow, TableCell, TableHeaderCell } from '@astryxdesign/core/Table';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';
import FormSchemaBuilder from './approval/FormSchemaBuilder';
import ApprovalLineSelector from './approval/ApprovalLineSelector';
import type { ApproverCandidate } from '@/types/approval';
import { FiPlus, FiDownload, FiEdit2, FiTrash2, FiUploadCloud, FiFileText, FiFolder } from 'react-icons/fi';
import {
  DEFAULT_APPROVAL_TEMPLATES,
  DEFAULT_TEMPLATE_CATEGORIES,
  UNCATEGORIZED_LABEL,
} from '@/lib/defaultApprovalTemplates';

/** '+ 새 대분류 직접 입력' 셀렉터 항목의 내부 값 */
const NEW_CATEGORY_VALUE = '__new__';

export default function ApprovalTemplateManager({ isAdmin = true }: { isAdmin?: boolean }) {
  const { showAlert, AlertContainer } = useAlert();
  const { confirm, ConfirmContainer } = useConfirm();
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApprovalTemplate | null>(null);

  // 업로드 폼 상태
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    file: null as File | null,
  });
  // 대분류: 셀렉터 값('' = 미분류, NEW_CATEGORY_VALUE = 직접 입력) + 직접 입력 텍스트
  const [categoryValue, setCategoryValue] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  // 목록 상단 대분류 필터 ('' = 전체)
  const [categoryFilter, setCategoryFilter] = useState('');
  // 대분류 관리(이름 변경) 다이얼로그
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryRenames, setCategoryRenames] = useState<Record<string, string>>({});
  const [isRenamingCategories, setIsRenamingCategories] = useState(false);
  // 기본 양식 시딩 (자동 1회 + 수동 버튼)
  const [isSeeding, setIsSeeding] = useState(false);
  const didAutoSeedRef = useRef(false);
  /** 마지막 목록 조회가 성공했는지 — 실패로 빈 목록이 된 상태에서 시딩하면 중복이 생긴다 */
  const loadSucceededRef = useRef(false);
  const [templateType, setTemplateType] = useState<'file' | 'form' | 'hybrid'>('file');
  const [formSchema, setFormSchema] = useState<FormSchema | undefined>(undefined);
  // 기본 결재선 — 이 양식으로 기안하면 자동으로 채워진다 (기안자가 수정 가능)
  const [defaultLine, setDefaultLine] = useState<ApproverCandidate[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 상태 토글 버튼에 마우스를 올린 행 — 라벨을 '누르면 될 결과'로 바꿔 보여준다 */
  const [hoveredToggleId, setHoveredToggleId] = useState<string | number | null>(null);

  // 템플릿 로드
  useEffect(() => {
    loadTemplates();
  }, []);

  /** 목록 조회. 실패하면 null — '양식 0개'와 구분해야 자동 시딩이 오작동하지 않는다 */
  const loadTemplates = async (): Promise<ApprovalTemplate[] | null> => {
    setIsLoading(true);
    try {
      const response = await getApprovalTemplates();
      const list: ApprovalTemplate[] = response.templates || [];
      setTemplates(list);
      loadSucceededRef.current = true;
      return list;
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
      loadSucceededRef.current = false;
      showAlert({
        type: 'error',
        title: '로드 실패',
        message: '양식 템플릿을 불러오는데 실패했습니다.',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 기본 제공 양식을 등록한다. 이름이 같은 양식은 건너뛰므로 여러 번 눌러도 중복되지 않는다.
   * @returns 새로 추가된 양식 수
   */
  const seedDefaultTemplates = async (existing: ApprovalTemplate[]): Promise<number> => {
    const existingNames = new Set(existing.map((t) => t.name.trim()));
    const missing = DEFAULT_APPROVAL_TEMPLATES.filter((def) => !existingNames.has(def.name));
    if (missing.length === 0) return 0;

    // 결재선이 비면 기안 제출 자체가 막힌다 — 기관 관리자를 기본 결재자로 넣어
    // 시딩 직후 바로 기안할 수 있게 한다 (관리자가 나중에 양식별로 바꿀 수 있음)
    let seedLine: ApproverCandidate[] = [];
    try {
      const response = await getApproverCandidates();
      const candidates: ApproverCandidate[] = Array.isArray(response?.candidates) ? response.candidates : [];
      const admin = candidates.find((c) => c.approverType === 'ADMIN') || candidates[0];
      if (admin) seedLine = [admin];
    } catch (error) {
      console.error('기본 결재선 지정용 결재자 조회 실패:', error);
    }

    // 순차 등록 — 동시에 쏘면 백엔드 쪽 정렬(createdAt)이 뒤섞이고 실패 원인 파악이 어렵다
    let added = 0;
    for (const def of missing) {
      try {
        await createApprovalTemplate({
          name: def.name,
          description: def.description,
          category: def.category,
          templateType: 'form',
          formSchema: JSON.stringify(def.schema),
          defaultApprovalLine: seedLine.length > 0 ? JSON.stringify(seedLine) : undefined,
        });
        added += 1;
      } catch (error) {
        console.error(`기본 양식 등록 실패: ${def.name}`, error);
      }
    }
    return added;
  };

  // 양식이 하나도 없는 신규 기관이면 기본 양식을 자동으로 넣어준다 (세션당 1회만 시도)
  useEffect(() => {
    if (!isAdmin || isLoading || didAutoSeedRef.current) return;
    // 조회 자체가 실패했으면 '양식 없음'이라고 단정할 수 없다 — 시딩하지 않는다
    if (!loadSucceededRef.current) return;
    if (templates.length > 0) {
      didAutoSeedRef.current = true;
      return;
    }
    didAutoSeedRef.current = true;
    (async () => {
      setIsSeeding(true);
      try {
        const added = await seedDefaultTemplates([]);
        if (added > 0) {
          await loadTemplates();
          showAlert({
            type: 'success',
            title: '기본 양식 준비 완료',
            message: `바로 사용할 수 있는 기본 결재 양식 ${added}종을 등록했습니다. 필요에 맞게 수정하거나 삭제할 수 있어요.`,
          });
        }
      } finally {
        setIsSeeding(false);
      }
    })();
    // templates/isLoading이 바뀔 때만 판단하면 충분하다 (ref로 1회 보장)
  }, [isAdmin, isLoading, templates.length]);

  // 수동 "기본 양식 불러오기"
  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const added = await seedDefaultTemplates(templates);
      if (added > 0) {
        await loadTemplates();
        showAlert({ type: 'success', title: '불러오기 완료', message: `기본 양식 ${added}종을 추가했습니다.` });
      } else {
        showAlert({ type: 'info', title: '추가할 양식 없음', message: '기본 양식이 이미 모두 등록되어 있습니다.' });
      }
    } finally {
      setIsSeeding(false);
    }
  };

  /** 현재 등록된 양식에서 실제로 쓰이는 대분류 + 기본 대분류를 합친 목록 */
  const knownCategories = useMemo(() => {
    const used = templates.map((t) => (t.category || '').trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_TEMPLATE_CATEGORIES, ...used]));
  }, [templates]);

  /** 목록에 실제로 존재하는 대분류만 (필터·이름변경 대상) */
  const usedCategories = useMemo(
    () => Array.from(new Set(templates.map((t) => (t.category || '').trim()).filter(Boolean))),
    [templates],
  );

  const hasUncategorized = useMemo(
    () => templates.some((t) => !(t.category || '').trim()),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    if (!categoryFilter) return templates;
    if (categoryFilter === UNCATEGORIZED_LABEL) return templates.filter((t) => !(t.category || '').trim());
    return templates.filter((t) => (t.category || '').trim() === categoryFilter);
  }, [templates, categoryFilter]);

  /** 대분류 이름 일괄 변경 — 그 분류의 모든 양식 category를 새 이름으로 바꾼다 */
  const handleRenameCategories = async () => {
    const changes = Object.entries(categoryRenames)
      .map(([from, to]) => [from, to.trim()] as const)
      .filter(([from, to]) => to && to !== from);
    if (changes.length === 0) {
      setShowCategoryManager(false);
      return;
    }

    setIsRenamingCategories(true);
    try {
      for (const [from, to] of changes) {
        const targets = templates.filter((t) => (t.category || '').trim() === from);
        for (const target of targets) {
          await updateApprovalTemplate(String(target.id), {
            name: target.name,
            description: target.description,
            category: to,
            templateType: target.templateType,
            fileUrl: target.fileUrl || undefined,
            fileName: target.fileName || undefined,
            fileSize: target.fileSize || undefined,
            formSchema: typeof target.formSchema === 'string'
              ? target.formSchema
              : target.formSchema ? JSON.stringify(target.formSchema) : undefined,
            defaultApprovalLine: target.defaultApprovalLine || undefined,
          });
        }
        // 필터가 옛 이름을 가리키고 있으면 새 이름으로 따라가게 한다
        setCategoryFilter((current) => (current === from ? to : current));
      }
      await loadTemplates();
      setShowCategoryManager(false);
      setCategoryRenames({});
      showAlert({ type: 'success', title: '변경 완료', message: '대분류 이름을 변경했습니다.' });
    } catch (error) {
      console.error('대분류 이름 변경 실패:', error);
      showAlert({ type: 'error', title: '변경 실패', message: '대분류 이름 변경에 실패했습니다.' });
    } finally {
      setIsRenamingCategories(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm(prev => ({ ...prev, file }));
    }
  };

  // 파일 크기 포맷 — 온라인 폼 양식은 크기가 없으므로 빈 문자열로 둔다
  const formatFileSize = (bytes?: number | null) => {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // 파일 업로드 API 호출
  const uploadFileToServer = async (file: File): Promise<{ filePath: string; fileName: string; fileSize: number } | null> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v1/files/upload?category=templates', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '파일 업로드 실패');
    }

    const result = await response.json();
    return {
      filePath: result.filePath,
      fileName: result.fileName,
      fileSize: result.fileSize,
    };
  };

  // 양식 업로드
  const handleUpload = async () => {
    if (!uploadForm.name.trim()) {
      showAlert({ type: 'error', title: '입력 오류', message: '양식명을 입력해주세요.' });
      return;
    }
    // 파일 필수 체크: file/hybrid 타입이고 신규 등록이면서 파일 없을 때
    if (templateType !== 'form' && !uploadForm.file && !editingTemplate) {
      showAlert({ type: 'error', title: '입력 오류', message: '파일을 선택해주세요.' });
      return;
    }

    setIsUploading(true);
    try {
      let fileUrl = editingTemplate?.fileUrl || '';
      let fileName = editingTemplate?.fileName || '';
      let fileSize = editingTemplate?.fileSize || 0;

      // 새 파일이 있으면 서버에 업로드
      if (uploadForm.file) {
        const uploadResult = await uploadFileToServer(uploadForm.file);
        if (uploadResult) {
          fileUrl = uploadResult.filePath;
          fileName = uploadResult.fileName;
          fileSize = uploadResult.fileSize;
        }
      }

      // 직접 입력을 골랐으면 입력값을, 아니면 선택값을 그대로 쓴다 (빈 값이면 미분류)
      const category = (categoryValue === NEW_CATEGORY_VALUE ? customCategory : categoryValue).trim();

      if (editingTemplate) {
        // 수정
        await updateApprovalTemplate(String(editingTemplate.id), {
          name: uploadForm.name,
          description: uploadForm.description,
          category,
          fileUrl: templateType !== 'form' ? fileUrl : undefined,
          fileName: templateType !== 'form' ? fileName : undefined,
          fileSize: templateType !== 'form' ? fileSize : undefined,
          templateType,
          formSchema: formSchema ? JSON.stringify(formSchema) : undefined,
          defaultApprovalLine: defaultLine.length > 0 ? JSON.stringify(defaultLine) : undefined,
        });
        showAlert({ type: 'success', title: '수정 완료', message: '양식이 수정되었습니다.' });
      } else {
        // 생성
        await createApprovalTemplate({
          name: uploadForm.name,
          description: uploadForm.description,
          category,
          fileUrl: templateType !== 'form' ? fileUrl : undefined,
          fileName: templateType !== 'form' ? fileName : undefined,
          fileSize: templateType !== 'form' ? fileSize : undefined,
          templateType,
          formSchema: formSchema ? JSON.stringify(formSchema) : undefined,
          defaultApprovalLine: defaultLine.length > 0 ? JSON.stringify(defaultLine) : undefined,
        });
        showAlert({ type: 'success', title: '등록 완료', message: '양식이 등록되었습니다.' });
      }

      setShowUploadModal(false);
      setEditingTemplate(null);
      setUploadForm({ name: '', description: '', file: null });
      setCategoryValue('');
      setCustomCategory('');
      setTemplateType('file');
      setFormSchema(undefined);
      setDefaultLine([]);
      loadTemplates();
    } catch (error) {
      console.error('양식 저장 실패:', error);
      showAlert({ type: 'error', title: '저장 실패', message: '양식 저장에 실패했습니다.' });
    } finally {
      setIsUploading(false);
    }
  };

  // 활성화/비활성화 토글
  const handleToggleActive = async (id: string | number) => {
    const target = templates.find((t) => String(t.id) === String(id));

    // 비활성화하면 직원 신청 화면(웹·앱)의 양식 목록에서 조용히 사라지므로 먼저 알려준다
    if (target?.isActive) {
      const confirmed = await confirm({
        title: '양식 비활성화',
        message: `'${target.name}' 양식을 비활성화하면 직원들의 결재 신청 화면(웹·앱)에서 이 양식이 보이지 않게 됩니다.\n이미 제출된 문서는 그대로 유지되며, 언제든 다시 활성화할 수 있습니다.`,
        confirmText: '비활성화',
        type: 'warning',
      });
      if (!confirmed) return;
    }

    try {
      await toggleApprovalTemplateActive(String(id));
      loadTemplates();
      showAlert({ type: 'success', title: '상태 변경', message: '양식 상태가 변경되었습니다.' });
    } catch (error) {
      console.error('상태 변경 실패:', error);
      showAlert({ type: 'error', title: '변경 실패', message: '양식 상태 변경에 실패했습니다.' });
    }
  };

  // 템플릿 삭제
  const handleDelete = async (id: string | number, name: string) => {
    const confirmed = await confirm({
      title: '양식 삭제',
      message: `"${name}" 양식을 삭제하시겠습니까?\n관련된 결재 요청도 모두 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteApprovalTemplate(String(id));
      loadTemplates();
      showAlert({ type: 'success', title: '삭제 완료', message: '양식이 삭제되었습니다.' });
    } catch (error: unknown) {
      console.error('삭제 실패:', error);
      let errorMessage = '양식 삭제에 실패했습니다.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      showAlert({ type: 'error', title: '삭제 실패', message: errorMessage });
    }
  };

  // 편집 모달 열기
  const openEditModal = (template: ApprovalTemplate) => {
    setEditingTemplate(template);
    setUploadForm({
      name: template.name,
      description: template.description,
      file: null,
    });
    // 기존 대분류가 기본 목록에 없는 이름이면 '직접 입력'으로 열어 그대로 보이게 한다
    const existingCategory = (template.category || '').trim();
    if (!existingCategory) {
      setCategoryValue('');
      setCustomCategory('');
    } else if (knownCategories.includes(existingCategory)) {
      setCategoryValue(existingCategory);
      setCustomCategory('');
    } else {
      setCategoryValue(NEW_CATEGORY_VALUE);
      setCustomCategory(existingCategory);
    }
    setTemplateType(template.templateType || 'file');
    const schema = template.formSchema
      ? (typeof template.formSchema === 'string' ? JSON.parse(template.formSchema) : template.formSchema)
      : undefined;
    setFormSchema(schema);
    try {
      const line = template.defaultApprovalLine ? JSON.parse(template.defaultApprovalLine) : [];
      setDefaultLine(Array.isArray(line) ? line : []);
    } catch {
      setDefaultLine([]);
    }
    setShowUploadModal(true);
  };

  // 모달 닫기
  const closeModal = () => {
    setShowUploadModal(false);
    setEditingTemplate(null);
    setUploadForm({ name: '', description: '', file: null });
    setCategoryValue('');
    setCustomCategory('');
    setTemplateType('file');
    setFormSchema(undefined);
    setDefaultLine([]);
  };

  // 파일 다운로드
  const handleDownload = async (template: ApprovalTemplate) => {
    try {
      const downloadUrl = `/api/v1/files/download?path=${encodeURIComponent(template.fileUrl)}&fileName=${encodeURIComponent(template.fileName)}`;
      const token = localStorage.getItem('authToken');

      const response = await fetch(downloadUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error('파일 다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = template.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('파일 다운로드 실패:', error);
      showAlert({ type: 'error', title: '다운로드 실패', message: '파일 다운로드에 실패했습니다.' });
    }
  };

  const isUploadDisabled = isUploading || !uploadForm.name.trim() || (templateType !== 'form' && !uploadForm.file && !editingTemplate);

  return (
    <>
      <AlertContainer />
      <ConfirmContainer />
      <VStack gap={6}>
        {/* 헤더 */}
        <HStack hAlign="between" vAlign="center">
          <VStack gap={1}>
            <Text as="h2" type="display-3" weight="bold">양식 관리</Text>
            <Text type="supporting">전자결재 양식 파일을 관리합니다</Text>
          </VStack>
          {isAdmin && (
            <HStack gap={2}>
              <Button
                label="기본 양식 불러오기"
                variant="secondary"
                icon={<Icon icon={FiDownload} size="sm" />}
                isLoading={isSeeding}
                onClick={handleSeedDefaults}
              />
              <Button
                label="새 양식 등록"
                variant="primary"
                icon={<Icon icon={FiPlus} size="sm" />}
                onClick={() => setShowUploadModal(true)}
              />
            </HStack>
          )}
        </HStack>

        {/* 대분류 필터 — 등록된 대분류가 있을 때만 노출 */}
        {!isLoading && (usedCategories.length > 0 || hasUncategorized) && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Icon icon={FiFolder} size="sm" color="secondary" />
            <Button
              label={`전체 (${templates.length})`}
              variant={categoryFilter === '' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCategoryFilter('')}
            />
            {usedCategories.map((category) => (
              <Button
                key={category}
                label={`${category} (${templates.filter((t) => (t.category || '').trim() === category).length})`}
                variant={categoryFilter === category ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(category)}
              />
            ))}
            {hasUncategorized && (
              <Button
                label={`${UNCATEGORIZED_LABEL} (${templates.filter((t) => !(t.category || '').trim()).length})`}
                variant={categoryFilter === UNCATEGORIZED_LABEL ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(UNCATEGORIZED_LABEL)}
              />
            )}
            {isAdmin && usedCategories.length > 0 && (
              <Button
                label="대분류 이름 변경"
                variant="ghost"
                size="sm"
                icon={<Icon icon={FiEdit2} size="sm" />}
                onClick={() => {
                  setCategoryRenames(Object.fromEntries(usedCategories.map((c) => [c, c])));
                  setShowCategoryManager(true);
                }}
              />
            )}
          </HStack>
        )}

        {/* 템플릿 목록 */}
        <Card padding={0}>
          {isLoading ? (
            <Loading label="양식을 불러오는 중..." />
          ) : isSeeding && templates.length === 0 ? (
            <Loading label="기본 양식을 준비하는 중..." />
          ) : templates.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <Table hasHover dividers="rows">
                <thead>
                  <TableRow isHeaderRow>
                    <TableHeaderCell>양식명</TableHeaderCell>
                    <TableHeaderCell>대분류</TableHeaderCell>
                    <TableHeaderCell>설명</TableHeaderCell>
                    <TableHeaderCell>유형</TableHeaderCell>
                    <TableHeaderCell>파일</TableHeaderCell>
                    <TableHeaderCell>상태</TableHeaderCell>
                    <TableHeaderCell>수정일</TableHeaderCell>
                    {isAdmin && <TableHeaderCell>액션</TableHeaderCell>}
                  </TableRow>
                </thead>
                <tbody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Text weight="semibold">{template.name}</Text>
                      </TableCell>
                      <TableCell>
                        <HStack>
                          {(template.category || '').trim() ? (
                            <Badge variant="blue" label={(template.category || '').trim()} />
                          ) : (
                            <Text type="supporting" color="secondary">{UNCATEGORIZED_LABEL}</Text>
                          )}
                        </HStack>
                      </TableCell>
                      <TableCell>
                        <Text type="supporting">{template.description}</Text>
                      </TableCell>
                      <TableCell>
                        <HStack>
                          {template.templateType === 'form' ? (
                            <Badge variant="teal" label="온라인 폼" />
                          ) : template.templateType === 'hybrid' ? (
                            <Badge variant="cyan" label="혼합" />
                          ) : (
                            <Badge variant="neutral" label="파일" />
                          )}
                        </HStack>
                      </TableCell>
                      <TableCell>
                        {/* 온라인 폼 양식은 첨부 파일이 없다 — 다운로드 버튼 대신 상태를 알린다 */}
                        {template.fileName ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon icon={FiDownload} size="sm" />}
                            label={
                              formatFileSize(template.fileSize)
                                ? `${template.fileName} (${formatFileSize(template.fileSize)})`
                                : template.fileName
                            }
                            onClick={() => handleDownload(template)}
                          />
                        ) : (
                          <Text type="supporting" color="secondary">
                            {template.templateType === 'form' ? '파일 없음 (온라인 폼)' : '파일 없음'}
                          </Text>
                        )}
                      </TableCell>
                      <TableCell>
                        <HStack>
                          {isAdmin ? (
                            // 평소엔 현재 상태를, 마우스를 올리면 누르면 될 결과를 보여준다
                            // (버튼 라벨이 상태인지 동작인지 헷갈리지 않게)
                            <span
                              onMouseEnter={() => setHoveredToggleId(template.id)}
                              onMouseLeave={() => setHoveredToggleId(null)}
                              onFocus={() => setHoveredToggleId(template.id)}
                              onBlur={() => setHoveredToggleId(null)}
                              style={{ display: 'inline-flex' }}
                            >
                              <Button
                                variant={
                                  hoveredToggleId === template.id
                                    ? (template.isActive ? 'destructive' : 'primary')
                                    : (template.isActive ? 'secondary' : 'ghost')
                                }
                                size="sm"
                                label={
                                  hoveredToggleId === template.id
                                    ? (template.isActive ? '비활성화하기' : '활성화하기')
                                    : (template.isActive ? '활성화' : '비활성화')
                                }
                                onClick={() => handleToggleActive(template.id)}
                              />
                            </span>
                          ) : (
                            <Badge
                              variant={template.isActive ? 'success' : 'neutral'}
                              label={template.isActive ? '활성화' : '비활성화'}
                            />
                          )}
                        </HStack>
                      </TableCell>
                      <TableCell>
                        <HStack>
                          <Text type="supporting">
                            {format(new Date(template.updatedAt), 'MM.dd HH:mm', { locale: ko })}
                          </Text>
                        </HStack>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <HStack gap={1}>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              label="편집"
                              tooltip="편집"
                              icon={<Icon icon={FiEdit2} size="sm" />}
                              onClick={() => openEditModal(template)}
                            />
                            <IconButton
                              variant="ghost"
                              size="sm"
                              label="삭제"
                              tooltip="삭제"
                              icon={<Icon icon={FiTrash2} size="sm" />}
                              onClick={() => handleDelete(template.id, template.name)}
                            />
                          </HStack>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </tbody>
              </Table>
              {/* 필터 결과가 비었을 때 — 표 머리글만 남으면 왜 비었는지 알 수 없다 */}
              {filteredTemplates.length === 0 && (
                <div style={{ padding: 'var(--spacing-10) var(--spacing-6)' }}>
                  <VStack gap={2} hAlign="center">
                    <Text color="secondary">이 대분류에 속한 양식이 없습니다</Text>
                    <Button label="전체 보기" variant="ghost" size="sm" onClick={() => setCategoryFilter('')} />
                  </VStack>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '80px var(--spacing-6)' }}>
              <VStack gap={2} hAlign="center">
                <FiFileText size={48} style={{ color: 'var(--color-icon-disabled)' }} />
                <Text type="large" color="secondary">등록된 양식이 없습니다</Text>
                <Text type="supporting">새 양식 등록 버튼을 눌러 양식 파일을 업로드하세요</Text>
                {isAdmin && (
                  <Button
                    label="기본 양식 불러오기"
                    variant="primary"
                    size="sm"
                    isLoading={isSeeding}
                    onClick={handleSeedDefaults}
                  />
                )}
              </VStack>
            </div>
          )}
        </Card>
      </VStack>

      {/* 업로드 모달 */}
      <Dialog
        isOpen={showUploadModal}
        onOpenChange={(open) => { if (!open) closeModal(); }}
        purpose="form"
        width={templateType === 'file' ? 440 : 900}
      >
        <Layout
          header={
            <DialogHeader
              title={editingTemplate ? '양식 편집' : '새 양식 등록'}
              onOpenChange={(open) => { if (!open) closeModal(); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text type="supporting">
                  {editingTemplate ? '양식 정보를 수정하세요' : '양식 유형을 선택하고 등록하세요'}
                </Text>

                {/* 양식 유형 선택 */}
                <VStack gap={2}>
                  <Text type="label">양식 유형</Text>
                  <SegmentedControl
                    value={templateType}
                    onChange={(value) => setTemplateType(value as 'file' | 'form' | 'hybrid')}
                    label="양식 유형"
                    layout="fill"
                  >
                    <SegmentedControlItem value="file" label="파일" />
                    <SegmentedControlItem value="form" label="온라인 폼" />
                    <SegmentedControlItem value="hybrid" label="혼합" />
                  </SegmentedControl>
                </VStack>

                {/* 양식명 */}
                <TextInput
                  label="양식명"
                  isRequired
                  value={uploadForm.name}
                  onChange={(value) => setUploadForm(prev => ({ ...prev, name: value }))}
                  placeholder="양식명을 입력하세요"
                />

                {/* 설명 */}
                <TextInput
                  label="설명"
                  value={uploadForm.description}
                  onChange={(value) => setUploadForm(prev => ({ ...prev, description: value }))}
                  placeholder="양식 설명을 입력하세요"
                />

                {/* 기안 대분류 — 결재 내역·양식 목록에서 이 분류로 묶어 볼 수 있다 */}
                <VStack gap={2}>
                  <Selector
                    label="기안 대분류"
                    placeholder="대분류를 선택하세요 (선택 안 하면 미분류)"
                    value={categoryValue}
                    options={[
                      ...knownCategories.map((category) => ({ value: category, label: category })),
                      { value: NEW_CATEGORY_VALUE, label: '+ 새 대분류 직접 입력' },
                    ]}
                    hasClear
                    onChange={(value) => {
                      setCategoryValue(value || '');
                      if (value !== NEW_CATEGORY_VALUE) setCustomCategory('');
                    }}
                  />
                  {categoryValue === NEW_CATEGORY_VALUE && (
                    <TextInput
                      label="새 대분류 이름"
                      value={customCategory}
                      onChange={setCustomCategory}
                      placeholder="예: 회계, 시설, 안전"
                    />
                  )}
                  <Text type="supporting" color="secondary">
                    공문 · 교육 · 인사처럼 기안의 종류를 묶는 이름입니다. 결재 신청과 결재 내역에서 이 분류로 골라 볼 수 있어요.
                  </Text>
                </VStack>

                {/* 기본 결재선 — 이 양식으로 기안하면 자동으로 채워진다 */}
                <VStack gap={1}>
                  <ApprovalLineSelector value={defaultLine} onChange={setDefaultLine} />
                  <Text type="supporting" color="secondary">
                    기본 결재선을 정해두면 이 양식으로 기안할 때 자동으로 채워집니다. 기안자가 문서마다 수정할 수 있어요.
                  </Text>
                </VStack>

                {/* 온라인 폼 빌더 */}
                {(templateType === 'form' || templateType === 'hybrid') && (
                  <VStack gap={2}>
                    <Text type="label">온라인 폼 구성</Text>
                    <FormSchemaBuilder
                      initialSchema={formSchema}
                      onSchemaChange={(schema) => setFormSchema(schema)}
                      templateName={uploadForm.name}
                      defaultApprovalLine={defaultLine}
                    />
                  </VStack>
                )}

                {/* 파일 업로드 */}
                {templateType !== 'form' && (
                  <VStack gap={2}>
                    <Text type="label">
                      {templateType === 'file' ? '양식 파일 *' : '양식 파일 (선택)'}
                    </Text>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept=".hwp,.hwpx,.doc,.docx,.pdf,.xls,.xlsx"
                      style={{ display: 'none' }}
                    />
                    <div
                      className="carev-upload-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-6)',
                        border: '2px dashed var(--color-border, var(--color-border))',
                        borderRadius: 'var(--radius-inner)',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {uploadForm.file ? (
                        <HStack gap={3} hAlign="center" vAlign="center">
                          <Icon icon={FiFileText} size="lg" color="accent" />
                          <VStack gap={0.5}>
                            <Text weight="semibold">{uploadForm.file.name}</Text>
                            <Text type="supporting">{formatFileSize(uploadForm.file.size)}</Text>
                          </VStack>
                        </HStack>
                      ) : (
                        <VStack gap={1} hAlign="center">
                          <FiUploadCloud size={32} style={{ color: 'var(--color-icon-disabled)' }} />
                          <Text color="secondary">클릭하여 파일 선택</Text>
                          <Text type="supporting">지원 형식: .hwp, .docx, .pdf, .xlsx</Text>
                        </VStack>
                      )}
                    </div>
                    {editingTemplate && !uploadForm.file && editingTemplate.fileName && (
                      <Text type="supporting">현재 파일: {editingTemplate.fileName}</Text>
                    )}
                  </VStack>
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button label="취소" variant="ghost" onClick={closeModal} />
                <Button
                  label={editingTemplate ? '저장' : '등록'}
                  variant="primary"
                  onClick={handleUpload}
                  isLoading={isUploading}
                  isDisabled={isUploadDisabled}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      {/* 대분류 이름 변경 — 해당 분류의 모든 양식이 함께 바뀐다 */}
      <Dialog
        isOpen={showCategoryManager}
        onOpenChange={(open) => { if (!open) { setShowCategoryManager(false); setCategoryRenames({}); } }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="대분류 이름 변경"
              onOpenChange={(open) => { if (!open) { setShowCategoryManager(false); setCategoryRenames({}); } }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Text type="supporting" color="secondary">
                  이름을 바꾸면 그 대분류에 속한 양식이 모두 새 이름으로 바뀝니다.
                  양식별 대분류를 따로 옮기려면 각 양식의 편집에서 바꿔주세요.
                </Text>
                {usedCategories.map((category) => (
                  <TextInput
                    key={category}
                    label={`${category} (양식 ${templates.filter((t) => (t.category || '').trim() === category).length}개)`}
                    value={categoryRenames[category] ?? category}
                    onChange={(value) => setCategoryRenames((prev) => ({ ...prev, [category]: value }))}
                  />
                ))}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="ghost"
                  onClick={() => { setShowCategoryManager(false); setCategoryRenames({}); }}
                />
                <Button
                  label="저장"
                  variant="primary"
                  onClick={handleRenameCategories}
                  isLoading={isRenamingCategories}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
