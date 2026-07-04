'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getApprovalTemplates, createApprovalTemplate, updateApprovalTemplate, toggleApprovalTemplateActive, deleteApprovalTemplate } from '@/lib/apiService';
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
import { Spinner } from '@astryxdesign/core/Spinner';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Table, TableRow, TableCell, TableHeaderCell } from '@astryxdesign/core/Table';
import { useAlert } from './Alert';
import { useConfirm } from './ConfirmDialog';
import FormSchemaBuilder from './approval/FormSchemaBuilder';
import { FiPlus, FiDownload, FiEdit2, FiTrash2, FiUploadCloud, FiFileText } from 'react-icons/fi';

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
  const [templateType, setTemplateType] = useState<'file' | 'form' | 'hybrid'>('file');
  const [formSchema, setFormSchema] = useState<FormSchema | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 템플릿 로드
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await getApprovalTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
      showAlert({
        type: 'error',
        title: '로드 실패',
        message: '양식 템플릿을 불러오는데 실패했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm(prev => ({ ...prev, file }));
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number) => {
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

      if (editingTemplate) {
        // 수정
        await updateApprovalTemplate(String(editingTemplate.id), {
          name: uploadForm.name,
          description: uploadForm.description,
          fileUrl: templateType !== 'form' ? fileUrl : undefined,
          fileName: templateType !== 'form' ? fileName : undefined,
          fileSize: templateType !== 'form' ? fileSize : undefined,
          templateType,
          formSchema: formSchema ? JSON.stringify(formSchema) : undefined,
        });
        showAlert({ type: 'success', title: '수정 완료', message: '양식이 수정되었습니다.' });
      } else {
        // 생성
        await createApprovalTemplate({
          name: uploadForm.name,
          description: uploadForm.description,
          fileUrl: templateType !== 'form' ? fileUrl : undefined,
          fileName: templateType !== 'form' ? fileName : undefined,
          fileSize: templateType !== 'form' ? fileSize : undefined,
          templateType,
          formSchema: formSchema ? JSON.stringify(formSchema) : undefined,
        });
        showAlert({ type: 'success', title: '등록 완료', message: '양식이 등록되었습니다.' });
      }

      setShowUploadModal(false);
      setEditingTemplate(null);
      setUploadForm({ name: '', description: '', file: null });
      setTemplateType('file');
      setFormSchema(undefined);
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
    setTemplateType(template.templateType || 'file');
    const schema = template.formSchema
      ? (typeof template.formSchema === 'string' ? JSON.parse(template.formSchema) : template.formSchema)
      : undefined;
    setFormSchema(schema);
    setShowUploadModal(true);
  };

  // 모달 닫기
  const closeModal = () => {
    setShowUploadModal(false);
    setEditingTemplate(null);
    setUploadForm({ name: '', description: '', file: null });
    setTemplateType('file');
    setFormSchema(undefined);
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
            <Button
              label="새 양식 등록"
              variant="primary"
              icon={<Icon icon={FiPlus} size="sm" />}
              onClick={() => setShowUploadModal(true)}
            />
          )}
        </HStack>

        {/* 템플릿 목록 */}
        <Card padding={0}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <Spinner size="lg" label="불러오는 중..." />
            </div>
          ) : templates.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <Table hasHover dividers="rows">
                <thead>
                  <TableRow isHeaderRow>
                    <TableHeaderCell>양식명</TableHeaderCell>
                    <TableHeaderCell>설명</TableHeaderCell>
                    <TableHeaderCell>유형</TableHeaderCell>
                    <TableHeaderCell>파일</TableHeaderCell>
                    <TableHeaderCell>상태</TableHeaderCell>
                    <TableHeaderCell>수정일</TableHeaderCell>
                    {isAdmin && <TableHeaderCell>액션</TableHeaderCell>}
                  </TableRow>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Text weight="semibold">{template.name}</Text>
                      </TableCell>
                      <TableCell>
                        <Text type="supporting">{template.description}</Text>
                      </TableCell>
                      <TableCell>
                        <HStack hAlign="center">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={FiDownload} size="sm" />}
                          label={`${template.fileName} (${formatFileSize(template.fileSize)})`}
                          onClick={() => handleDownload(template)}
                        />
                      </TableCell>
                      <TableCell>
                        <HStack hAlign="center">
                          {isAdmin ? (
                            <Button
                              variant={template.isActive ? 'secondary' : 'ghost'}
                              size="sm"
                              label={template.isActive ? '활성화' : '비활성화'}
                              onClick={() => handleToggleActive(template.id)}
                            />
                          ) : (
                            <Badge
                              variant={template.isActive ? 'success' : 'neutral'}
                              label={template.isActive ? '활성화' : '비활성화'}
                            />
                          )}
                        </HStack>
                      </TableCell>
                      <TableCell>
                        <HStack hAlign="center">
                          <Text type="supporting">
                            {format(new Date(template.updatedAt), 'MM.dd HH:mm', { locale: ko })}
                          </Text>
                        </HStack>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <HStack gap={1} hAlign="center">
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
            </div>
          ) : (
            <div style={{ padding: '80px 24px' }}>
              <VStack gap={2} hAlign="center">
                <FiFileText size={48} style={{ color: 'var(--color-icon-tertiary, #cbd5e1)' }} />
                <Text type="large" color="secondary">등록된 양식이 없습니다</Text>
                <Text type="supporting">새 양식 등록 버튼을 눌러 양식 파일을 업로드하세요</Text>
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

                {/* 온라인 폼 빌더 */}
                {(templateType === 'form' || templateType === 'hybrid') && (
                  <VStack gap={2}>
                    <Text type="label">온라인 폼 구성</Text>
                    <FormSchemaBuilder
                      initialSchema={formSchema}
                      onSchemaChange={(schema) => setFormSchema(schema)}
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
                          <FiUploadCloud size={32} style={{ color: 'var(--color-icon-tertiary, #94a3b8)' }} />
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
    </>
  );
}
