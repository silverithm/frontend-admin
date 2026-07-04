'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { register } from '@/lib/apiService';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    organization: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }

    try {
      // Spring Boot 백엔드로 회원가입 요청
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'ADMIN',
        phone: formData.phone,
        organization: formData.organization
      });

      // 성공 메시지 표시
      setSuccessMessage('회원가입이 완료되었습니다. 잠시 후 로그인 페이지로 이동합니다.');

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      console.error('회원가입 오류:', error);
      setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
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
            <VStack gap={1} hAlign="center">
              <Text type="display-3" weight="bold" color="accent">케어브이</Text>
              <Text type="supporting" color="secondary">관리자 계정 만들기</Text>
            </VStack>

            {successMessage ? (
              <Banner status="success" title={successMessage} />
            ) : (
              <form onSubmit={handleSubmit}>
                <VStack gap={4}>
                  <TextInput
                    label="이름"
                    type="text"
                    htmlName="name"
                    value={formData.name}
                    onChange={(value, e) => handleChange(e)}
                    placeholder="이름 입력"
                    isRequired
                  />

                  <TextInput
                    label="이메일"
                    type="email"
                    htmlName="email"
                    value={formData.email}
                    onChange={(value, e) => handleChange(e)}
                    placeholder="이메일 주소 입력"
                    isRequired
                  />

                  <TextInput
                    label="비밀번호"
                    type="password"
                    htmlName="password"
                    value={formData.password}
                    onChange={(value, e) => handleChange(e)}
                    placeholder="비밀번호 입력"
                    isRequired
                  />

                  <TextInput
                    label="비밀번호 확인"
                    type="password"
                    htmlName="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={(value, e) => handleChange(e)}
                    placeholder="비밀번호 확인"
                    isRequired
                  />

                  <TextInput
                    label="전화번호"
                    type="text"
                    htmlName="phone"
                    value={formData.phone}
                    onChange={(value, e) => handleChange(e)}
                    placeholder="전화번호 입력 (예: 010-1234-5678)"
                    isRequired
                  />

                  <TextInput
                    label="소속 기관"
                    type="text"
                    htmlName="organization"
                    value={formData.organization}
                    onChange={(value, e) => handleChange(e)}
                    placeholder="소속 기관명 입력"
                    isRequired
                  />

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
            )}

            {/* 하단 링크 */}
            <VStack gap={2} hAlign="center">
              <HStack gap={1} hAlign="center" vAlign="center">
                <Text type="supporting" color="secondary">이미 계정이 있으신가요?</Text>
                <Link href="/login">로그인</Link>
              </HStack>
              <Link href="/">메인 페이지로 돌아가기</Link>
            </VStack>
          </VStack>
        </Card>
      </motion.div>
    </div>
  );
}
