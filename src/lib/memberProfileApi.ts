// 회원 프로필 사진 업로드/삭제 API
// apiService.ts의 fetchWithAuth는 Content-Type: application/json을 강제하므로
// multipart 요청은 기존 파일 업로드 컴포넌트(EmployeeApproval 등)와 동일하게
// localStorage의 authToken을 직접 읽어 헤더에 실어 보낸다.

export interface MemberProfileImageResult {
  profileImageUrl: string | null;
  [key: string]: unknown;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

async function parseJsonSafely(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function uploadMemberProfileImage(
  memberId: string,
  file: File
): Promise<MemberProfileImageResult> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAuthToken();

  const response = await fetch(`/api/v1/members/${memberId}/profile-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || '프로필 사진 업로드에 실패했습니다.');
  }

  return data as MemberProfileImageResult;
}

export async function deleteMemberProfileImage(memberId: string): Promise<MemberProfileImageResult> {
  const token = getAuthToken();

  const response = await fetch(`/api/v1/members/${memberId}/profile-image`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || '프로필 사진 삭제에 실패했습니다.');
  }

  return data as MemberProfileImageResult;
}
