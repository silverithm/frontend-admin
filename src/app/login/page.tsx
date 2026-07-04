'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { signin, memberSignin, findPassword } from '@/lib/apiService';
import { subscriptionService } from '@/services/subscription';
import { useAlert } from '@/components/Alert';
import { LoginType } from '@/types/auth';

export default function LoginPage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [loginType, setLoginType] = useState<LoginType>('admin');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showFindPassword, setShowFindPassword] = useState(false);
  const [findPasswordEmail, setFindPasswordEmail] = useState('');
  const [findPasswordLoading, setFindPasswordLoading] = useState(false);
  const [findPasswordMessage, setFindPasswordMessage] = useState('');
  const [findPasswordError, setFindPasswordError] = useState('');

  useEffect(() => {
    // 컴포넌트 마운트 시 저장된 이메일 불러오기
    try {
      const savedEmail = localStorage.getItem('rememberedEmail');
      const isRemembered = localStorage.getItem('rememberEmail') === 'true';
      const savedLoginType = localStorage.getItem('lastLoginType') as LoginType;

      if (savedEmail && isRemembered) {
        setFormData(prev => ({ ...prev, email: savedEmail }));
        setRememberEmail(true);
      }
      if (savedLoginType) {
        setLoginType(savedLoginType);
      }
    } catch (error) {
      console.error('localStorage 접근 오류:', error);
    }
  }, []);

  const handleRememberChange = (checked: boolean) => {
    setRememberEmail(checked);

    // 체크 해제 시 즉시 localStorage에서 삭제
    if (!checked) {
      try {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberEmail');
      } catch (error) {
        console.error('localStorage 삭제 오류:', error);
      }
    }
  };

  const checkSubscriptionAndRedirect = async () => {
    try {
      // 구독 정보 확인
      const subscription = await subscriptionService.getMySubscription();

      // 활성 구독이 있으면 관리자 페이지로
      if (subscriptionService.isActive(subscription)) {
        router.push('/admin');
      } else {
        // 만료된 구독이 있으면 관리자 페이지로 (SubscriptionGuard가 처리)
        router.push('/admin');
      }
    } catch (error: any) {

      // 404 에러이고 "No subscription found" 메시지인 경우에만 구독이 없다고 판단
      if (error.status === 404 &&
          (error.message === 'No subscription found' ||
           error.data?.error === 'No subscription found')) {
        router.push('/subscription-check');
      } else if (error.status >= 500) {
        // 500 에러 시 에러 메시지 표시 후 랜딩페이지로
        showAlert({
          type: 'error',
          title: '서버 오류',
          message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도하거나 고객센터에 문의해주세요.',
          duration: 7000
        });
        setTimeout(() => router.push('/'), 3000);
      } else {
        // 기타 오류 시 관리자 페이지로 (SubscriptionGuard가 처리)
        router.push('/admin');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 로그인 타입 저장
      localStorage.setItem('lastLoginType', loginType);

      if (loginType === 'admin') {
        // 관리자 로그인 - Spring Boot 백엔드로 로그인 요청
        await signin(formData.email, formData.password);
        localStorage.setItem('userRole', 'ROLE_ADMIN');
        localStorage.setItem('loginType', 'admin');

        // 아이디 기억하기 처리
        try {
          if (rememberEmail) {
            localStorage.setItem('rememberedEmail', formData.email);
            localStorage.setItem('rememberEmail', 'true');
          } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberEmail');
          }
        } catch (error) {
          console.error('localStorage 저장 오류:', error);
        }

        // 로그인 성공 후 구독 상태 확인
        await checkSubscriptionAndRedirect();
      } else {
        // 직원 로그인
        await memberSignin(formData.email, formData.password);

        // 아이디 기억하기 처리
        try {
          if (rememberEmail) {
            localStorage.setItem('rememberedEmail', formData.email);
            localStorage.setItem('rememberEmail', 'true');
          } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberEmail');
          }
        } catch (error) {
          console.error('localStorage 저장 오류:', error);
        }

        // 직원은 직원 전용 페이지로 이동
        localStorage.setItem('loginType', 'employee');
        router.push('/employee');
      }
    } catch (error) {
      console.error('로그인 오류:', error);

      // 더 자세한 오류 메시지 표시
      if (error instanceof Error) {
        if (error.message.includes('400')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (error.message.includes('401')) {
          setError('인증에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
        } else if (error.message.includes('500')) {
          setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError(`로그인 오류: ${error.message}`);
        }
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindPasswordLoading(true);
    setFindPasswordError('');
    setFindPasswordMessage('');

    try {
      await findPassword(findPasswordEmail);
      setFindPasswordMessage('임시 비밀번호가 이메일로 전송되었습니다.');
      setTimeout(() => {
        setShowFindPassword(false);
        setFindPasswordEmail('');
        setFindPasswordMessage('');
      }, 3000);
    } catch (error) {
      setFindPasswordError('이메일 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setFindPasswordLoading(false);
    }
  };

  return (
    <>
      <AlertContainer />
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          position: 'relative',
          background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 55%, #312e81 100%)',
        }}
      >
        {/* 뒤로가기 버튼 */}
        <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 10 }}>
          <Button
            label="메인으로"
            variant="ghost"
            size="sm"
            icon={<span aria-hidden>←</span>}
            onClick={() => router.push('/')}
          />
        </div>

        <Card width="100%" maxWidth={420} padding={6}>
          <VStack gap={5}>
            {/* 로고 */}
            <HStack hAlign="center">
              <Image
                src="/images/logo-text.png"
                alt="케어브이 로고"
                width={200}
                height={67}
                priority
              />
            </HStack>

            {/* 로그인 타입 토글 */}
            <VStack gap={2}>
              <SegmentedControl
                value={loginType}
                onChange={(value) => setLoginType(value as LoginType)}
                label="로그인 유형"
                layout="fill"
              >
                <SegmentedControlItem value="admin" label="관리자" />
                <SegmentedControlItem value="employee" label="직원" />
              </SegmentedControl>
              <Text type="supporting" justify="center">
                {loginType === 'admin'
                  ? '센터 관리자 계정으로 로그인합니다'
                  : '직원 계정으로 로그인합니다'}
              </Text>
            </VStack>

            {/* 로그인 폼 */}
            <form onSubmit={handleSubmit}>
              <VStack gap={4}>
                <TextInput
                  label="이메일"
                  type="email"
                  value={formData.email}
                  onChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
                  placeholder="이메일 주소 입력"
                  htmlName="email"
                  isRequired
                />

                <TextInput
                  label="비밀번호"
                  type="password"
                  value={formData.password}
                  onChange={(value) => setFormData((prev) => ({ ...prev, password: value }))}
                  placeholder="비밀번호 입력"
                  htmlName="password"
                  isRequired
                />

                <HStack hAlign="between" vAlign="center">
                  <CheckboxInput
                    label="이메일 저장"
                    value={rememberEmail}
                    onChange={handleRememberChange}
                    size="sm"
                  />
                  <Button
                    label="비밀번호 찾기"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFindPassword(true)}
                  />
                </HStack>

                {error && (
                  <Banner status="error" title={error} />
                )}

                <Button
                  label={loginType === 'admin' ? '관리자 로그인' : '직원 로그인'}
                  variant="primary"
                  size="lg"
                  type="submit"
                  isLoading={isLoading}
                />
              </VStack>
            </form>

            {/* 회원가입 안내 */}
            <HStack gap={1} hAlign="center" vAlign="center">
              <Text type="supporting">계정이 없으신가요?</Text>
              <Link href="/signup">회원가입</Link>
            </HStack>
          </VStack>
        </Card>
      </div>

      {/* 비밀번호 찾기 모달 */}
      <Dialog
        isOpen={showFindPassword}
        onOpenChange={(open) => {
          setShowFindPassword(open);
          if (!open) {
            setFindPasswordEmail('');
            setFindPasswordError('');
            setFindPasswordMessage('');
          }
        }}
        purpose="form"
        width={440}
      >
        <form onSubmit={handleFindPassword}>
          <Layout
            header={
              <DialogHeader
                title="비밀번호 찾기"
                onOpenChange={(open) => setShowFindPassword(open)}
              />
            }
            content={
              <LayoutContent>
                <VStack gap={4}>
                  <Text type="supporting">
                    가입 시 사용한 이메일 주소를 입력하시면 임시 비밀번호를 보내드립니다.
                  </Text>
                  <TextInput
                    label="이메일"
                    type="email"
                    value={findPasswordEmail}
                    onChange={(value) => setFindPasswordEmail(value)}
                    placeholder="이메일 주소 입력"
                    isRequired
                  />
                  {findPasswordError && (
                    <Banner status="error" title={findPasswordError} />
                  )}
                  {findPasswordMessage && (
                    <Banner status="success" title={findPasswordMessage} />
                  )}
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack gap={2} hAlign="end">
                  <Button
                    label="취소"
                    variant="ghost"
                    onClick={() => setShowFindPassword(false)}
                  />
                  <Button
                    label="전송"
                    variant="primary"
                    type="submit"
                    isLoading={findPasswordLoading}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </form>
      </Dialog>
    </>
  );
}
