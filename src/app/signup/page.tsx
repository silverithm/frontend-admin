'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { signup } from '@/lib/apiService';
import { useAlert } from '@/components/Alert';

// 다음 주소 API 타입 정의
declare global {
  interface Window {
    daum: any;
  }
}

export default function SignupPage() {
  const router = useRouter();
  const { showAlert, AlertContainer } = useAlert();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    organizationName: '',
    address: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  // 다음 주소 API 스크립트 로드
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // 다음 주소 검색 기능
  const handleAddressSearch = () => {
    if (typeof window !== 'undefined' && window.daum) {
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          // 도로명 주소와 지번 주소 중 선택
          let addr = '';
          if (data.userSelectedType === 'R') {
            addr = data.roadAddress;
          } else {
            addr = data.jibunAddress;
          }

          // 기본 주소 설정
          setFormData(prev => ({
            ...prev,
            address: addr
          }));
        }
      }).open();
    } else {
      showAlert({
        type: 'warning',
        title: '주소 검색 서비스 로딩 중',
        message: '주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
      });
    }
  };

  // 이메일 형식 검증
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    // 이메일 검증
    if (!formData.email) {
      setError('이메일을 입력해주세요.');
      return false;
    }
    if (!isValidEmail(formData.email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return false;
    }

    // 비밀번호 검증
    if (!formData.password) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }
    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    // 이름 검증
    if (!formData.username) {
      setError('이름을 입력해주세요.');
      return false;
    }

    // 회사명 검증
    if (!formData.organizationName) {
      setError('회사명을 입력해주세요.');
      return false;
    }

    // 회사 주소 검증
    if (!formData.address) {
      setError('회사 주소를 입력해주세요.');
      return false;
    }

    // 개인정보 수집 및 이용 동의 검증
    if (!privacyAgreed) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {


      // 백엔드 UserDataDTO 구조에 맞춰 회원가입 요청
      const result = await signup({
        name: formData.username,
        email: formData.email,
        password: formData.password,
        role: 'ROLE_ADMIN',
        companyName: formData.organizationName,
        companyAddress: formData.address,
      });


      // 회원가입 성공 후 로그인 페이지로 이동
      showAlert({
        type: 'success',
        title: '회원가입 완료',
        message: '회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.'
      });
      router.push('/login');
    } catch (error) {
      console.error('회원가입 오류:', error);

      if (error instanceof Error) {
        if (error.message.includes('409')) {
          setError('이미 존재하는 이메일입니다.');
        } else if (error.message.includes('400')) {
          setError('입력 정보가 올바르지 않습니다. 다시 확인해주세요.');
        } else if (error.message.includes('500')) {
          setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError(`회원가입 오류: ${error.message}`);
        }
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
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
          padding: 'var(--spacing-4)',
          background: 'linear-gradient(180deg, #0f1115 0%, #16181d 100%)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: 448 }}
        >
          <Card width="100%" padding={6}>
            <VStack gap={5}>
              {/* 헤더 */}
              <VStack gap={3} hAlign="center">
                <HStack hAlign="center">
                  <Image
                    src="/images/logo.png"
                    alt="케어베케이션 로고"
                    width={200}
                    height={67}
                    priority
                  />
                </HStack>
                <VStack gap={1} hAlign="center">
                  <Text type="display-3" weight="bold" justify="center">
                    관리자 회원가입
                  </Text>
                  <Text type="supporting" justify="center">
                    케어브이 서비스를 시작해보세요
                  </Text>
                </VStack>
              </VStack>

              {/* 회원가입 폼 */}
              <form onSubmit={handleSubmit}>
                <VStack gap={4}>
                  <TextInput
                    label="이메일"
                    type="email"
                    value={formData.email}
                    onChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
                    placeholder="example@email.com"
                    htmlName="email"
                    isRequired
                  />

                  <TextInput
                    label="비밀번호"
                    type="password"
                    value={formData.password}
                    onChange={(value) => setFormData((prev) => ({ ...prev, password: value }))}
                    placeholder="8자 이상의 비밀번호"
                    htmlName="password"
                    isRequired
                  />

                  <TextInput
                    label="비밀번호 확인"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(value) => setFormData((prev) => ({ ...prev, confirmPassword: value }))}
                    placeholder="비밀번호를 다시 입력하세요"
                    htmlName="confirmPassword"
                    isRequired
                  />

                  <TextInput
                    label="이름"
                    type="text"
                    value={formData.username}
                    onChange={(value) => setFormData((prev) => ({ ...prev, username: value }))}
                    placeholder="홍길동"
                    htmlName="username"
                    isRequired
                  />

                  <TextInput
                    label="회사명"
                    type="text"
                    value={formData.organizationName}
                    onChange={(value) => setFormData((prev) => ({ ...prev, organizationName: value }))}
                    placeholder="예: **주간보호"
                    htmlName="organizationName"
                    isRequired
                  />

                  {/* 회사 주소 (검색 전용, 직접 입력 불가) */}
                  <HStack gap={2} vAlign="end">
                    <div style={{ flex: 1 }}>
                      <TextInput
                        label="회사 주소"
                        type="text"
                        value={formData.address}
                        onChange={() => {}}
                        placeholder="클릭하여 주소 검색"
                        htmlName="address"
                        isRequired
                      />
                    </div>
                    <Button
                      label="주소 검색"
                      variant="secondary"
                      size="md"
                      type="button"
                      onClick={handleAddressSearch}
                    />
                  </HStack>

                  {/* 개인정보 수집 및 이용 동의 */}
                  <Card variant="muted" padding={4}>
                    <VStack gap={1.5}>
                      <CheckboxInput
                        label="개인정보 수집 및 이용에 동의합니다"
                        value={privacyAgreed}
                        onChange={(checked) => setPrivacyAgreed(checked)}
                        size="sm"
                        isRequired
                      />
                      <Link
                        href="https://plip.kr/pcc/d9017bf3-00dc-4f8f-b750-f7668e2b7bb7/consent/1.html"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        개인정보 수집 및 이용 동의서 보기
                      </Link>
                    </VStack>
                  </Card>

                  {error && (
                    <Banner status="error" title={error} />
                  )}

                  <Button
                    label="회원가입"
                    variant="primary"
                    size="lg"
                    type="submit"
                    isLoading={isLoading}
                  />
                </VStack>
              </form>

              {/* 하단 링크 */}
              <VStack gap={2} hAlign="center">
                <HStack gap={1} hAlign="center" vAlign="center">
                  <Text type="supporting">이미 계정이 있으신가요?</Text>
                  <Link href="/login">로그인</Link>
                </HStack>
                <Link href="/">메인 페이지로 돌아가기</Link>
              </VStack>
            </VStack>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
