'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  IconArrowLeft,
  IconBuilding,
  IconMapPin,
  IconUser,
  IconKey,
  IconTrash,
  IconCopy,
} from '@tabler/icons-react';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { deleteAdminUser, changePassword, getUserInfo, updateCompanyName, updateCompanyAddress, uploadCompanySeal, deleteCompanySeal } from '@/lib/apiService';
import { FileInput } from '@astryxdesign/core/FileInput';
import SubscriptionInfo from '@/components/SubscriptionInfo';
import MySignatureCard from '@/components/approval/MySignatureCard';
import { duration } from '@/theme/motion';
import { Link } from '@astryxdesign/core/Link';

interface OrganizationProfileData {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  companyCode?: string;
  // 기타 필요한 회사 정보 필드들
  companyAddressName?: string;
  adminName?: string;
}

const gradientBar =
  'linear-gradient(90deg, #ffffff 0%, #f7f8fa 55%, #ffffff 100%)';

export default function OrganizationProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrganizationProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 관리자만 접근 가능
  useEffect(() => {
    const loginType = localStorage.getItem('loginType');
    if (loginType !== 'admin') {
      router.replace('/employee');
    }
  }, [router]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<OrganizationProfileData | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 기관 직인
  const [sealUrl, setSealUrl] = useState<string | null>(null);
  const [sealFile, setSealFile] = useState<File | null>(null);
  const [isSealSaving, setIsSealSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      // 운영 API에서 회사 정보 조회 (실패 시 localStorage 폴백)
      let profileData: OrganizationProfileData;
      try {
        const info = await getUserInfo();
        profileData = {
          name: info.companyName || '',
          address: info.companyAddressName || '',
          contactEmail: '',
          contactPhone: '',
          companyCode: info.companyCode || '',
          companyAddressName: info.companyAddressName || '',
          adminName: info.userName || '',
        };
        setSealUrl(info.companySealUrl || null);

        // 다른 화면들이 참조하는 localStorage 동기화
        if (info.companyName) localStorage.setItem('companyName', info.companyName);
        if (info.companyAddressName) localStorage.setItem('companyAddressName', info.companyAddressName);
        if (info.companyCode) localStorage.setItem('companyCode', info.companyCode);
      } catch (apiError) {
        console.warn('회사 정보 API 조회 실패, localStorage 사용:', apiError);
        profileData = {
          name: localStorage.getItem('companyName') || '',
          address: localStorage.getItem('companyAddressName') || '',
          contactEmail: '',
          contactPhone: '',
          companyCode: localStorage.getItem('companyCode') || '',
          companyAddressName: localStorage.getItem('companyAddressName') || '',
          adminName: localStorage.getItem('userName') || '',
        };
      }

      setProfile(profileData);
      setFormData(profileData);
    } catch (err) {
      setError('회사 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !profile) return;
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      // 변경된 항목만 실제 백엔드에 반영
      if (formData.name && formData.name !== profile.name) {
        await updateCompanyName(formData.name);
        localStorage.setItem('companyName', formData.name);
      }
      if (formData.address && formData.address !== profile.address) {
        await updateCompanyAddress(formData.address);
        localStorage.setItem('companyAddressName', formData.address);
      }

      setProfile(formData);
      setIsEditing(false);
      setSuccessMessage('회사 정보가 성공적으로 업데이트되었습니다.');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '회사 정보 업데이트에 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 이미지 파일 → PNG data URL (JPG도 PNG로 재인코딩)
  const imageFileToPngDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('이미지 처리에 실패했습니다.'));
          return;
        }
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('이미지를 불러올 수 없습니다.'));
      };
      image.src = url;
    });

  const handleUploadSeal = async () => {
    if (!sealFile) return;
    setIsSealSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const dataUrl = await imageFileToPngDataUrl(sealFile);
      const response = await uploadCompanySeal(dataUrl);
      setSealUrl(response?.sealUrl || null);
      setSealFile(null);
      setSuccessMessage('기관 직인이 등록되었습니다. 결재 최종 승인 시 자동으로 날인됩니다.');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '직인 등록에 실패했습니다.');
    } finally {
      setIsSealSaving(false);
    }
  };

  const handleDeleteSeal = async () => {
    setIsSealSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await deleteCompanySeal();
      setSealUrl(null);
      setSuccessMessage('기관 직인이 삭제되었습니다.');
    } catch (err) {
      setError('직인 삭제에 실패했습니다.');
    } finally {
      setIsSealSaving(false);
    }
  };

  const handleCopyCompanyCode = async () => {
    if (!profile?.companyCode) return;

    try {
      await navigator.clipboard.writeText(profile.companyCode);
      setSuccessMessage('회사 코드가 복사되었습니다.');
      setError('');
    } catch (err) {
      setError('회사 코드 복사에 실패했습니다.');
    }
  };

  if (isLoading && !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-muted)' }}>
        <Text type="body">회사 정보를 불러오는 중...</Text>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-muted)' }}>
        <Card padding={6}>
          <VStack gap={4} hAlign="center">
            <Text type="body" color="inherit"><span style={{ color: 'var(--color-text-red)' }}>{error}</span></Text>
            <Button label="관리자 홈으로" variant="primary" onClick={() => router.push('/admin')} />
          </VStack>
        </Card>
      </div>
    );
  }

  if (!profile) { // profile이 null이고, 에러도 없고, 로딩도 아닌 경우 (이론상 발생하기 어려움)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-muted)' }}>
        <Card padding={6}>
          <VStack gap={4} hAlign="center">
            <Text type="body">회사 정보를 찾을 수 없습니다.</Text>
            <Button label="관리자 홈으로" variant="primary" onClick={() => router.push('/admin')} />
          </VStack>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background-muted)' }}>
      {/* 모던 헤더 */}
      <header style={{ background: gradientBar, boxShadow: 'var(--shadow-low)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'var(--spacing-6) var(--spacing-4)' }}>
          <HStack hAlign="between" vAlign="center">
            <HStack gap={3} vAlign="center">
              <Image
                src="/images/logo.png"
                alt="케어베케이션 로고"
                width={120}
                height={40}
              />
              <div>
                <Text type="display-3" color="primary" weight="bold">기관 프로필</Text>
                <div style={{ color: 'var(--color-text-blue)' }}>
                  <Text type="supporting" color="inherit">기관 정보 관리</Text>
                </div>
              </div>
            </HStack>
            <Button
              label="관리자 홈으로"
              variant="secondary"
              icon={<Icon icon={IconArrowLeft} size="sm" />}
              onClick={() => router.push('/admin')}
            />
          </HStack>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: 'var(--spacing-8)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.mediumMax }}
        >
          <VStack gap={6}>
            <VStack gap={1}>
              <Text type="display-3" weight="bold">기관 정보</Text>
              <Text type="supporting">기관의 기본 정보를 관리할 수 있습니다</Text>
            </VStack>

            {successMessage && (
              <Banner status="success" title={successMessage} />
            )}
            {error && !successMessage && (
              <Banner status="error" title={error} />
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <VStack gap={5}>
                  <TextInput
                    label="회사명"
                    type="text"
                    htmlName="name"
                    value={formData?.name || ''}
                    onChange={(value) => setFormData(formData ? { ...formData, name: value } : formData)}
                    isRequired
                  />
                  <TextInput
                    label="회사 주소"
                    type="text"
                    htmlName="address"
                    value={formData?.address || ''}
                    onChange={(value) => setFormData(formData ? { ...formData, address: value } : formData)}
                  />
                  <TextInput
                    label="관리자명"
                    type="text"
                    htmlName="adminName"
                    value={formData?.adminName || ''}
                    onChange={(value) => setFormData(formData ? { ...formData, adminName: value } : formData)}
                    description="관리자명은 수정할 수 없습니다."
                    isDisabled
                  />
                  <HStack gap={2} hAlign="end">
                    <Button
                      label="취소"
                      variant="secondary"
                      type="button"
                      onClick={() => { setIsEditing(false); setError(''); setSuccessMessage(''); setFormData(profile); }}
                    />
                    <Button
                      label="저장"
                      variant="primary"
                      type="submit"
                      isLoading={isLoading}
                    />
                  </HStack>
                </VStack>
              </form>
            ) : (
              <VStack gap={8}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 'var(--spacing-6)',
                  }}
                >
                  {/* 기관 정보 카드 */}
                  <Card padding={6}>
                    <HStack gap={3} vAlign="center">
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={IconBuilding} size="md" color="accent" />
                      </div>
                      <VStack gap={0.5}>
                        <Text type="supporting">회사명</Text>
                        <Text type="large" weight="semibold">{profile.name || '정보 없음'}</Text>
                      </VStack>
                    </HStack>
                  </Card>

                  {/* 위치 정보 카드 */}
                  <Card padding={6}>
                    <HStack gap={3} vAlign="center">
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={IconMapPin} size="md" color="secondary" />
                      </div>
                      <VStack gap={0.5}>
                        <Text type="supporting">회사 주소</Text>
                        <Text type="large" weight="semibold">{profile.address || '정보 없음'}</Text>
                      </VStack>
                    </HStack>
                  </Card>

                  {/* 관리자 정보 카드 */}
                  <Card padding={6}>
                    <HStack gap={3} vAlign="center">
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={IconUser} size="md" color="secondary" />
                      </div>
                      <VStack gap={0.5}>
                        <Text type="supporting">관리자명</Text>
                        <Text type="large" weight="semibold">{profile.adminName || '정보 없음'}</Text>
                      </VStack>
                    </HStack>
                  </Card>
                </div>

                {profile.companyCode && (
                  <Card variant="yellow" padding={6}>
                    <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
                      <VStack gap={2}>
                        <Text type="label" weight="medium">직원 회원가입용 회사 코드</Text>
                        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', letterSpacing: '0.3em', color: '#451a03' }}>
                          {profile.companyCode}
                        </div>
                        <Text type="supporting">
                          직원은 앱 회원가입 화면에서 이 코드를 입력하면 기존 회사 선택과 같은 방식으로 가입 요청을 보낼 수 있습니다.
                        </Text>
                      </VStack>
                      <Button
                        label="코드 복사"
                        variant="primary"
                        icon={<Icon icon={IconCopy} size="sm" />}
                        onClick={handleCopyCompanyCode}
                      />
                    </HStack>
                  </Card>
                )}

                {/* 구독 정보 섹션 */}
                <VStack gap={6}>
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-8)' }}>
                    <Text type="large" weight="semibold">구독 정보</Text>
                  </div>
                  <SubscriptionInfo />
                </VStack>

                {/* 인장/서명 섹션 */}
                <VStack gap={6}>
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-8)' }}>
                    <VStack gap={1}>
                      <Text type="large" weight="semibold">인장 / 서명</Text>
                      <Text type="supporting">
                        기관 직인은 결재 최종 승인 시 공문 발신명의에, 내 서명은 결재란에 자동으로 날인됩니다
                      </Text>
                    </VStack>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 'var(--spacing-4)',
                      alignItems: 'start',
                    }}
                  >
                    {/* 기관 직인 카드 */}
                    <Card padding={6}>
                      <VStack gap={4}>
                        <Text type="body" weight="medium">기관 직인</Text>
                        {sealUrl ? (
                          <VStack gap={3}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 140,
                                height: 140,
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-inner)',
                                background: 'var(--color-on-accent)',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sealUrl}
                                alt="기관 직인"
                                style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
                              />
                            </div>
                            <HStack gap={2}>
                              <Button
                                label="삭제"
                                variant="destructive"
                                size="sm"
                                isDisabled={isSealSaving}
                                onClick={handleDeleteSeal}
                              />
                            </HStack>
                            <Text type="supporting">새 이미지를 등록하면 기존 직인을 대체합니다.</Text>
                          </VStack>
                        ) : (
                          <Banner
                            status="info"
                            title="등록된 직인이 없습니다."
                            description="직인 이미지를 등록하면 승인 완료된 공문에 자동으로 찍힙니다."
                          />
                        )}
                        <FileInput
                          label="직인 이미지 (PNG/JPG, 배경 투명 권장)"
                          accept="image/png,image/jpeg"
                          value={sealFile}
                          onChange={(files) => {
                            const file = Array.isArray(files) ? files[0] ?? null : files;
                            setSealFile(file);
                          }}
                        />
                        <HStack hAlign="end">
                          <Button
                            label={isSealSaving ? '등록 중...' : '직인 등록'}
                            variant="primary"
                            isLoading={isSealSaving}
                            isDisabled={isSealSaving || !sealFile}
                            onClick={handleUploadSeal}
                          />
                        </HStack>
                      </VStack>
                    </Card>

                    {/* 내 서명 카드 */}
                    <Card padding={6}>
                      <VStack gap={4}>
                        <Text type="body" weight="medium">내 결재 서명</Text>
                        <MySignatureCard
                          onNotification={(message, type) => {
                            if (type === 'error') {
                              setError(message);
                              setSuccessMessage('');
                            } else {
                              setSuccessMessage(message);
                              setError('');
                            }
                          }}
                        />
                      </VStack>
                    </Card>
                  </div>
                </VStack>

                {/* 계정 설정 섹션 */}
                <VStack gap={6}>
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-8)' }}>
                    <Text type="large" weight="semibold">계정 설정</Text>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 'var(--spacing-4)',
                    }}
                  >
                    <Card variant="blue" padding={6}>
                      <VStack gap={4}>
                        <HStack gap={3} vAlign="center">
                          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon icon={IconKey} size="md" color="accent" />
                          </div>
                          <VStack gap={0.5}>
                            <Text type="body" weight="medium">비밀번호 변경</Text>
                            <Text type="supporting">계정 보안을 위해 주기적으로 변경하세요</Text>
                          </VStack>
                        </HStack>
                        <Button
                          label="비밀번호 변경하기"
                          variant="secondary"
                          onClick={() => setShowPasswordModal(true)}
                        />
                      </VStack>
                    </Card>

                    <Card variant="red" padding={6}>
                      <VStack gap={4}>
                        <HStack gap={3} vAlign="center">
                          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon icon={IconTrash} size="md" color="error" />
                          </div>
                          <VStack gap={0.5}>
                            <Text type="body" weight="medium">회원탈퇴</Text>
                            <Text type="supporting">모든 데이터가 삭제되며 복구할 수 없습니다</Text>
                          </VStack>
                        </HStack>
                        <Button
                          label="회원탈퇴"
                          variant="destructive"
                          onClick={() => setShowDeleteModal(true)}
                        />
                      </VStack>
                    </Card>
                  </div>
                </VStack>
              </VStack>
            )}
          </VStack>
      </motion.div>
      </main>

      {/* 푸터 */}
      <footer style={{ background: gradientBar, boxShadow: '0 -10px 30px rgba(0,0,0,0.25)', borderTop: '1px solid rgba(30,64,175,0.3)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'var(--spacing-10) var(--spacing-4)' }}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={6}>
            <VStack gap={4}>
              <Image
                src="/images/logo.png"
                alt="케어베케이션 로고"
                width={140}
                height={47}
              />
              <HStack gap={2} vAlign="center">
                <Link
                  href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(147,197,253,0.7)', textDecoration: 'none', fontSize: 'var(--font-size-base)' }}
                >
                  개인정보처리방침
                </Link>
                <span style={{ color: 'rgba(147,197,253,0.5)' }}>|</span>
                <Link
                  href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(147,197,253,0.7)', textDecoration: 'none', fontSize: 'var(--font-size-base)' }}
                >
                  이용약관
                </Link>
              </HStack>
            </VStack>
            <div style={{ color: 'rgba(191,219,254,0.7)' }}>
              <Text type="supporting" color="inherit">&copy; {new Date().getFullYear()} 케어브이. 모든 권리 보유.</Text>
            </div>
          </HStack>
        </div>
      </footer>

      {/* 비밀번호 변경 모달 */}
      <Dialog
        isOpen={showPasswordModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowPasswordModal(false);
            setPasswordForm({
              currentPassword: '',
              newPassword: '',
              confirmPassword: ''
            });
            setPasswordError('');
          }
        }}
        purpose="form"
        width={440}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPasswordError('');

            // 유효성 검사
            if (passwordForm.newPassword !== passwordForm.confirmPassword) {
              setPasswordError('새 비밀번호가 일치하지 않습니다.');
              return;
            }

            if (passwordForm.newPassword.length < 6) {
              setPasswordError('비밀번호는 6자 이상이어야 합니다.');
              return;
            }

            setIsChangingPassword(true);

            try {
              const userEmail = localStorage.getItem('userEmail') || '';
              await changePassword({
                email: userEmail,
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
              });

              setSuccessMessage('비밀번호가 성공적으로 변경되었습니다.');
              setShowPasswordModal(false);
              setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
              });
            } catch (err) {
              setPasswordError('비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
            } finally {
              setIsChangingPassword(false);
            }
          }}
        >
          <Layout
            header={
              <DialogHeader
                title="비밀번호 변경"
                onOpenChange={(open) => {
                  if (!open) {
                    setShowPasswordModal(false);
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                    setPasswordError('');
                  }
                }}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <TextInput
                    label="현재 비밀번호"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })}
                    isRequired
                  />
                  <TextInput
                    label="새 비밀번호"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })}
                    isRequired
                  />
                  <TextInput
                    label="새 비밀번호 확인"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })}
                    isRequired
                  />
                  {passwordError && (
                    <Banner status="error" title={passwordError} />
                  )}
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button
                    label="취소"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                      setPasswordError('');
                    }}
                  />
                  <Button
                    label="비밀번호 변경"
                    variant="primary"
                    type="submit"
                    isLoading={isChangingPassword}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </form>
      </Dialog>

      {/* 회원탈퇴 확인 모달 */}
      <Dialog
        isOpen={showDeleteModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setError('');
          }
        }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="회원탈퇴"
              onOpenChange={(open) => {
                if (!open) {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setError('');
                }
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <Banner
                  status="warning"
                  title="경고"
                  description="회원탈퇴 시 모든 데이터가 삭제되며, 이는 복구할 수 없습니다. 탈퇴를 원하시면 아래에 '탈퇴하겠습니다'라고 입력해주세요."
                />
                <TextInput
                  label="탈퇴 확인"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(value) => setDeleteConfirmText(value)}
                  placeholder="탈퇴하겠습니다"
                />
                {error && (
                  <Banner status="error" title={error} />
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                    setError('');
                  }}
                />
                <Button
                  label="회원탈퇴"
                  variant="destructive"
                  type="button"
                  isDisabled={deleteConfirmText !== '탈퇴하겠습니다' || isDeleting}
                  isLoading={isDeleting}
                  onClick={async () => {
                    if (deleteConfirmText !== '탈퇴하겠습니다') {
                      setError('확인 문구를 정확히 입력해주세요.');
                      return;
                    }

                    setIsDeleting(true);
                    setError('');

                    try {
                      await deleteAdminUser();
                      // 탈퇴 성공 시 로그인 페이지로 이동
                      router.push('/login');
                    } catch (err) {
                      setError('회원탈퇴에 실패했습니다. 다시 시도해주세요.');
                      console.error(err);
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </div>
  );
}
