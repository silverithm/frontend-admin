'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Banner } from '@astryxdesign/core/Banner';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Link } from '@astryxdesign/core/Link';
import { resetErrorMessage, validateNewPassword } from '@/lib/passwordReset';

type Phase = 'checking' | 'invalid' | 'form' | 'done';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // 만료·사용된 링크로 입력 칸을 보여 주지 않는다
  useEffect(() => {
    if (!token) {
      setPhase('invalid');
      return;
    }
    let alive = true;
    fetch(`/api/v1/password-reset/check?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { valid: false }))
      .then((b) => alive && setPhase(b?.valid ? 'form' : 'invalid'))
      .catch(() => alive && setPhase('invalid'));
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/v1/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(resetErrorMessage(body));
        return;
      }
      setPhase('done');
    } catch {
      setError('네트워크 오류로 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack gap={4}>
      <Text type="large">비밀번호 재설정</Text>
      {phase === 'checking' && <Text type="supporting">링크를 확인하는 중입니다…</Text>}
      {phase === 'invalid' && (
        <VStack gap={3}>
          <Banner status="error" title="링크가 만료되었거나 이미 사용되었습니다." />
          <Text type="supporting">로그인 화면에서 비밀번호 찾기를 다시 해 주세요. 링크는 30분 동안 한 번만 쓸 수 있습니다.</Text>
          <Link href="/login">로그인으로 가기</Link>
        </VStack>
      )}
      {phase === 'form' && (
        <form onSubmit={submit}>
          <VStack gap={4}>
            <Text type="supporting">새 비밀번호를 정해 주세요. (8자 이상)</Text>
            <TextInput label="새 비밀번호" type="password" value={password} onChange={setPassword} isRequired />
            <TextInput label="새 비밀번호 확인" type="password" value={confirm} onChange={setConfirm} isRequired />
            {error && <Banner status="error" title={error} />}
            <Button label="비밀번호 바꾸기" variant="primary" type="submit" isLoading={saving} />
          </VStack>
        </form>
      )}
      {phase === 'done' && (
        <VStack gap={3}>
          <Banner status="success" title="비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요." />
          <Link href="/login">로그인으로 가기</Link>
        </VStack>
      )}
    </VStack>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <Card>
          <div style={{ padding: 24 }}>
            <Suspense fallback={null}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </Card>
      </div>
    </main>
  );
}
