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
import { Grid } from '@astryxdesign/core/Grid';
import { Text } from '@astryxdesign/core/Text';
import { Icon } from '@astryxdesign/core/Icon';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { deleteAdminUser, changePassword, getUserInfo, updateCompanyName, updateCompanyAddress, uploadCompanySeal, deleteCompanySeal, updateCompanyHomepage } from '@/lib/apiService';
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

/**
 * 페이지 폭과 좌우 여백. 헤더·본문·푸터가 같은 값을 써야 세로선이 맞는다.
 * (예전에는 헤더만 spacing-4, 본문은 spacing-8이라 제목과 카드가 어긋나 보였다)
 */
const PAGE_MAX_WIDTH = 1120;
const PAGE_PADDING_X = 'var(--spacing-6)';

const pageContainer: React.CSSProperties = {
  maxWidth: PAGE_MAX_WIDTH,
  margin: '0 auto',
  paddingLeft: PAGE_PADDING_X,
  paddingRight: PAGE_PADDING_X,
};

/**
 * 섹션 하나 = 제목(+설명) + 내용.
 * 섹션마다 구분선·여백을 따로 적어 두면 화면이 들쭉날쭉해지므로 여기서 한 번만 정한다.
 */
function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="large" weight="semibold" color="primary">{title}</Text>
        {description && <Text type="supporting" color="secondary">{description}</Text>}
      </VStack>
      {children}
    </VStack>
  );
}

export default function OrganizationProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<OrganizationProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // 관리자만 접근 가능
  useEffect(() => {
    const loginType = localStorage.getItem('loginType');
    if (loginType !== 'admin') {
      router.replace('/employee');
    }
    setIsDemoMode(localStorage.getItem('isDemoMode') === 'true');
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

  // 기관 홈페이지 — 등록하면 사이드바에 바로가기가 생긴다
  const [homepageUrl, setHomepageUrl] = useState('');
  const [savedHomepageUrl, setSavedHomepageUrl] = useState<string | null>(null);
  const [isHomepageSaving, setIsHomepageSaving] = useState(false);

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
        setSavedHomepageUrl(info.companyHomepageUrl || null);
        setHomepageUrl(info.companyHomepageUrl || '');
        if (info.companyHomepageUrl) {
          localStorage.setItem('companyHomepageUrl', info.companyHomepageUrl);
        } else {
          localStorage.removeItem('companyHomepageUrl');
        }

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

  const handleSaveHomepage = async () => {
    setIsHomepageSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await updateCompanyHomepage(homepageUrl.trim());
      const saved: string | null = response?.homepageUrl ?? null;
      setSavedHomepageUrl(saved);
      setHomepageUrl(saved || '');
      // 사이드바가 참조하므로 바로 반영되도록 동기화한다
      if (saved) {
        localStorage.setItem('companyHomepageUrl', saved);
      } else {
        localStorage.removeItem('companyHomepageUrl');
      }
      window.dispatchEvent(new Event('carev:company-homepage-changed'));
      setSuccessMessage(saved
        ? '기관 홈페이지가 등록되었습니다. 왼쪽 메뉴에서 바로 여실 수 있습니다.'
        : '기관 홈페이지가 해제되었습니다.');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : '홈페이지 주소 저장에 실패했습니다.');
    } finally {
      setIsHomepageSaving(false);
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
      {/* 헤더 — 페이지 제목은 본문이 아니라 여기에만 둔다 (예전에는 헤더와 본문에 제목이 겹쳐 있었다) */}
      <header style={{ background: 'var(--color-background-card)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ ...pageContainer, paddingTop: 'var(--spacing-5)', paddingBottom: 'var(--spacing-5)' }}>
          <HStack hAlign="between" vAlign="center" gap={4}>
            <HStack gap={3} vAlign="center">
              <Image src="/images/carev-favicon.png" alt="케어브이" width={36} height={36} style={{ borderRadius: 'var(--radius-inner)' }} />
              <VStack gap={0.5}>
                <Text type="display-3" color="primary" weight="bold">기관 프로필</Text>
                <Text type="supporting" color="secondary">기관의 기본 정보와 계정을 관리합니다</Text>
              </VStack>
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
      <main style={{ ...pageContainer, paddingTop: 'var(--spacing-8)', paddingBottom: 'var(--spacing-10)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.mediumMax }}
        >
          <VStack gap={6}>

            {successMessage && (
              <Banner status="success" title={successMessage} />
            )}
            {error && !successMessage && (
              <Banner status="error" title={error} />
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <Card padding={6}>
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
                </Card>
              </form>
            ) : (
              <VStack gap={8}>
                <ProfileSection title="기관 정보" description="기관의 이름과 주소, 대표 관리자입니다">
                <Grid columns={{ minWidth: 260, max: 3 }} gap={4} align="stretch">
                  {/* 기관 정보 카드 */}
                  <Card padding={5} height="100%">
                    <HStack gap={3} vAlign="center">
                      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={IconBuilding} size="md" color="accent" />
                      </div>
                      <VStack gap={0.5}>
                        <Text type="supporting" color="secondary">회사명</Text>
                        <Text type="body" weight="semibold" color="primary">{profile.name || '정보 없음'}</Text>
                      </VStack>
                    </HStack>
                  </Card>

                  {/* 위치 정보 카드 */}
                  <Card padding={5} height="100%">
                    <HStack gap={3} vAlign="center">
                      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={IconMapPin} size="md" color="secondary" />
                      </div>
                      <VStack gap={0.5}>
                        <Text type="supporting" color="secondary">회사 주소</Text>
                        <Text type="body" weight="semibold" color="primary">{profile.address || '정보 없음'}</Text>
                      </VStack>
                    </HStack>
                  </Card>

                  {/* 관리자 정보 카드 */}
                  <Card padding={5} height="100%">
                    <HStack gap={3} vAlign="center">
                      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={IconUser} size="md" color="secondary" />
                      </div>
                      <VStack gap={0.5}>
                        <Text type="supporting" color="secondary">관리자명</Text>
                        <Text type="body" weight="semibold" color="primary">{profile.adminName || '정보 없음'}</Text>
                      </VStack>
                    </HStack>
                  </Card>
                </Grid>
                </ProfileSection>

                {profile.companyCode && (
                  <ProfileSection title="직원 가입 코드" description="직원분이 회원가입 화면에서 이 코드를 입력하면 우리 기관으로 가입 요청이 들어옵니다">
                  <Card variant="yellow" padding={5}>
                    <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
                      <VStack gap={1}>
                        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', letterSpacing: '0.28em', color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                          {profile.companyCode}
                        </div>
                        <Text type="supporting" color="secondary">복사해서 직원분께 전달해주세요</Text>
                      </VStack>
                      <Button
                        label="코드 복사"
                        variant="primary"
                        icon={<Icon icon={IconCopy} size="sm" />}
                        onClick={handleCopyCompanyCode}
                      />
                    </HStack>
                  </Card>
                  </ProfileSection>
                )}

                {/* 구독 정보 섹션 — SubscriptionInfo가 자체 제목을 그리므로 여기서 제목을 또 달지 않는다 */}
                <SubscriptionInfo />

                {/* 인장/서명 섹션 */}
                <ProfileSection
                  title="인장 / 서명"
                  description="기관 직인은 결재 최종 승인 시 공문 발신명의에, 내 서명은 결재란에 자동으로 날인됩니다"
                >
                  <Grid columns={{ minWidth: 320, max: 2 }} gap={4} align="stretch">
                    {/* 기관 직인 카드 */}
                    <Card padding={5} height="100%">
                      <VStack gap={4}>
                        <Text type="body" weight="medium" color="primary">기관 직인</Text>
                        {/* 등록 전에도 같은 크기의 자리를 잡아둔다 — 옆 서명 카드와 밀도를 맞추고,
                            등록 후에 화면이 갑자기 늘어나지 않게 하려는 것 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: 160,
                            border: sealUrl ? '1px solid var(--color-border)' : '1px dashed var(--color-border)',
                            borderRadius: 'var(--radius-inner)',
                            background: sealUrl ? 'var(--color-on-accent)' : 'var(--color-background-muted)',
                          }}
                        >
                          {sealUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sealUrl}
                              alt="기관 직인"
                              style={{ maxWidth: '70%', maxHeight: '85%', objectFit: 'contain' }}
                            />
                          ) : (
                            <VStack gap={1} hAlign="center">
                              <Text type="supporting" color="secondary">등록된 직인이 없습니다</Text>
                              <Text type="supporting" color="disabled">등록하면 승인된 공문에 자동으로 찍힙니다</Text>
                            </VStack>
                          )}
                        </div>
                        {sealUrl && (
                          <HStack gap={2} hAlign="between" vAlign="center">
                            <Text type="supporting" color="secondary">새 이미지를 등록하면 기존 직인을 대체합니다.</Text>
                            <Button
                              label="삭제"
                              variant="destructive"
                              size="sm"
                              isDisabled={isSealSaving}
                              onClick={handleDeleteSeal}
                            />
                          </HStack>
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
                    <Card padding={5} height="100%">
                      <VStack gap={4}>
                        <Text type="body" weight="medium" color="primary">내 결재 서명</Text>
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
                  </Grid>
                </ProfileSection>

                {/* 기관 홈페이지 섹션 */}
                <ProfileSection
                  title="기관 홈페이지"
                  description={'기관 홈페이지나 블로그 주소를 등록하면 왼쪽 메뉴 "연계기관" 위에 바로가기가 생깁니다'}
                >
                  <Card padding={5}>
                    <VStack gap={4}>
                      <TextInput
                        label="홈페이지 / 블로그 주소"
                        type="text"
                        value={homepageUrl}
                        onChange={(value) => setHomepageUrl(value)}
                        placeholder="https://blog.naver.com/우리기관"
                        hasClear
                      />
                      <Text type="supporting" color="secondary">
                        {savedHomepageUrl
                          ? '주소를 비우고 저장하면 바로가기가 사라집니다.'
                          : 'https:// 를 빼고 적으셔도 됩니다.'}
                      </Text>
                      <HStack hAlign="end">
                        <Button
                          label={isHomepageSaving ? '저장 중...' : '저장'}
                          variant="primary"
                          isLoading={isHomepageSaving}
                          isDisabled={isHomepageSaving || homepageUrl.trim() === (savedHomepageUrl || '')}
                          onClick={handleSaveHomepage}
                        />
                      </HStack>
                    </VStack>
                  </Card>
                </ProfileSection>

                {/* 계정 설정 섹션 */}
                <ProfileSection title="계정 설정">
                  <Grid columns={{ minWidth: 300, max: 2 }} gap={4} align="stretch">
                    <Card variant="blue" padding={5} height="100%">
                      <VStack gap={4} height="100%">
                        <HStack gap={3} vAlign="center">
                          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon icon={IconKey} size="md" color="accent" />
                          </div>
                          <VStack gap={0.5}>
                            <Text type="body" weight="medium" color="primary">비밀번호 변경</Text>
                            <Text type="supporting" color="secondary">계정 보안을 위해 주기적으로 변경하세요</Text>
                          </VStack>
                        </HStack>
                        {/* 두 카드의 버튼 높이를 맞춘다 */}
                        <div style={{ marginTop: 'auto' }} />
                        <Button
                          label="비밀번호 변경하기"
                          variant="secondary"
                          onClick={() => setShowPasswordModal(true)}
                        />
                      </VStack>
                    </Card>

                    {isDemoMode ? (
                      // 옆 카드와 같은 모양으로 맞춘다 (Banner는 높이가 늘지 않아 짝이 맞지 않았다)
                      <Card padding={5} height="100%">
                        <HStack gap={3} vAlign="center">
                          <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon icon="info" size="md" color="secondary" />
                          </div>
                          <VStack gap={0.5}>
                            <Text type="body" weight="medium" color="primary">체험 계정은 7일 후 자동 삭제됩니다</Text>
                            <Text type="supporting" color="secondary">별도 탈퇴가 필요하지 않습니다</Text>
                          </VStack>
                        </HStack>
                      </Card>
                    ) : (
                      <Card variant="red" padding={5} height="100%">
                        <VStack gap={4} height="100%">
                          <HStack gap={3} vAlign="center">
                            <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-inner)', background: 'var(--color-background-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon icon={IconTrash} size="md" color="error" />
                            </div>
                            <VStack gap={0.5}>
                              <Text type="body" weight="medium" color="primary">회원탈퇴</Text>
                              <Text type="supporting" color="secondary">모든 데이터가 삭제되며 복구할 수 없습니다</Text>
                            </VStack>
                          </HStack>
                          <div style={{ marginTop: 'auto' }} />
                          <Button
                            label="회원탈퇴"
                            variant="destructive"
                            onClick={() => setShowDeleteModal(true)}
                          />
                        </VStack>
                      </Card>
                    )}
                  </Grid>
                </ProfileSection>
              </VStack>
            )}
          </VStack>
      </motion.div>
      </main>

      {/* 푸터 — 예전에는 어두운 배경 시절의 파란 글씨·짙은 그림자가 남아 흰 배경에서 글씨가 보이지 않았다 */}
      <footer style={{ background: 'var(--color-background-card)', borderTop: '1px solid var(--color-border)' }}>
        <div style={{ ...pageContainer, paddingTop: 'var(--spacing-6)', paddingBottom: 'var(--spacing-6)' }}>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={4}>
            <HStack gap={3} vAlign="center">
              <Link
                href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/privacy/1.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                개인정보처리방침
              </Link>
              <Text type="supporting" color="disabled">|</Text>
              <Link
                href="https://relic-baboon-412.notion.site/silverithm-13c766a8bb468082b91ddbd2dd6ce45d"
                target="_blank"
                rel="noopener noreferrer"
              >
                이용약관
              </Link>
            </HStack>
            <Text type="supporting" color="secondary">&copy; {new Date().getFullYear()} 케어브이. 모든 권리 보유.</Text>
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
