/** 새 비밀번호 입력 검사 — 서버 규칙(8~100자)과 같다. 틀리면 이유 문구, 맞으면 null */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 100;

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하여야 합니다.`;
  if (password !== confirm) return '비밀번호 확인이 일치하지 않습니다.';
  return null;
}

/** 서버가 준 사유를 그대로 보여 주되, 없으면 기본 문구 */
export function resetErrorMessage(body: unknown, fallback = '비밀번호를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.'): string {
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; error?: unknown };
    if (typeof b.message === 'string' && b.message) return b.message;
    if (typeof b.error === 'string' && b.error) return b.error;
  }
  return fallback;
}
