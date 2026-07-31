// 케어브이 광장 API 클라이언트 (게시판·자료실).
// 읽기는 비로그인 허용(토큰 없이 호출), 쓰기는 토큰 필수 — 서버가 익명 마스킹·권한을 처리한다.

import type { BoardType, LibraryCategory } from './plazaStore';

export interface ApiPostSummary {
  id: number;
  board: BoardType;
  title: string;
  preview: string;
  displayAuthor: string;
  isAnonymous: boolean;
  isPinned: boolean;
  isMine: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  hasAccepted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiComment {
  id: number;
  parentId: number | null;
  displayAuthor: string;
  isAnonymous: boolean;
  isAccepted: boolean;
  isMine: boolean;
  content: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiPostDetail {
  id: number;
  board: BoardType;
  title: string;
  content: string;
  displayAuthor: string;
  isAnonymous: boolean;
  isPinned: boolean;
  isMine: boolean;
  viewCount: number;
  likeCount: number;
  likedByMe: boolean;
  reportedByMe: boolean;
  createdAt: string;
  updatedAt: string | null;
  comments: ApiComment[];
}

export interface ApiLibraryItem {
  id: number;
  category: LibraryCategory;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  displayUploader: string;
  isMine: boolean;
  reportedByMe: boolean;
  downloadCount: number;
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authorInfo() {
  if (typeof window === 'undefined') return { authorName: '사용자', companyName: null };
  return {
    authorName: localStorage.getItem('userName') || '사용자',
    companyName: localStorage.getItem('companyName') || null,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1/plaza/${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(options.headers as Record<string, string>),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `요청 실패 (${response.status})`);
  }
  return data as T;
}

// ── 게시글 ──────────────────────────────────────────────

export async function fetchPosts(params: {
  board?: string;
  sort?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<{ content: ApiPostSummary[]; totalPages: number; totalElements: number }> {
  const query = new URLSearchParams();
  if (params.board && params.board !== 'all') query.set('board', params.board);
  if (params.sort) query.set('sort', params.sort);
  if (params.search) query.set('search', params.search);
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 10));
  return request(`posts?${query.toString()}`);
}

export async function fetchPost(id: number): Promise<ApiPostDetail> {
  return request(`posts/${id}`);
}

export async function createPost(input: { board: BoardType; title: string; content: string; isAnonymous: boolean }): Promise<{ id: number }> {
  return request('posts', { method: 'POST', body: JSON.stringify({ ...input, ...authorInfo() }) });
}

export async function updatePost(id: number, input: { board: BoardType; title: string; content: string; isAnonymous: boolean }): Promise<void> {
  await request(`posts/${id}`, { method: 'PUT', body: JSON.stringify({ ...input, ...authorInfo() }) });
}

export async function deletePost(id: number): Promise<void> {
  await request(`posts/${id}`, { method: 'DELETE' });
}

export async function toggleLike(id: number): Promise<boolean> {
  const data = await request<{ liked: boolean }>(`posts/${id}/like`, { method: 'POST', body: JSON.stringify({}) });
  return data.liked;
}

export async function reportPost(id: number, reason: string): Promise<'reported' | 'already' | 'hidden'> {
  const data = await request<{ result: 'reported' | 'already' | 'hidden' }>(`posts/${id}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return data.result;
}

// ── 댓글 ──────────────────────────────────────────────

export async function addComment(postId: number, input: { parentId: number | null; content: string; isAnonymous: boolean }): Promise<void> {
  await request(`posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ ...input, ...authorInfo() }) });
}

export async function updateComment(commentId: number, content: string): Promise<void> {
  await request(`comments/${commentId}`, { method: 'PUT', body: JSON.stringify({ content }) });
}

export async function deleteComment(commentId: number): Promise<void> {
  await request(`comments/${commentId}`, { method: 'DELETE' });
}

export async function acceptComment(commentId: number): Promise<void> {
  await request(`comments/${commentId}/accept`, { method: 'POST', body: JSON.stringify({}) });
}

// ── 자료실 ────────────────────────────────────────────

export async function fetchLibraryItems(params: {
  category?: string;
  search?: string;
  page?: number;
  size?: number;
}): Promise<{ content: ApiLibraryItem[]; totalPages: number; totalElements: number }> {
  const query = new URLSearchParams();
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 30));
  return request(`library?${query.toString()}`);
}

export async function uploadLibraryItem(input: {
  category: LibraryCategory;
  title: string;
  description: string;
  file: File;
}): Promise<{ id: number }> {
  const form = new FormData();
  form.set('file', input.file);
  form.set('category', input.category);
  form.set('title', input.title);
  if (input.description) form.set('description', input.description);
  const info = authorInfo();
  form.set('uploaderName', info.authorName);
  if (info.companyName) form.set('companyName', info.companyName);
  return request('library', { method: 'POST', body: form });
}

/** 파일을 받아 브라우저 다운로드를 트리거한다 */
export async function downloadLibraryItem(id: number, fileName: string): Promise<void> {
  const response = await fetch(`/api/v1/plaza/library/${id}/download`, { headers: authHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '다운로드에 실패했습니다');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteLibraryItem(id: number): Promise<void> {
  await request(`library/${id}`, { method: 'DELETE' });
}

export async function reportLibraryItem(id: number, reason: string): Promise<'reported' | 'already'> {
  const data = await request<{ result: 'reported' | 'already' }>(`library/${id}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return data.result;
}
