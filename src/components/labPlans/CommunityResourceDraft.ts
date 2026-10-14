/** 자원연계 한 건의 입력 상태 — 어르신 선택(또는 기관 전체), 연계 날짜, 자원 종류, 기관, 담당자, 내용, 결과, 후속 확인 예정일, 연계기록지 제공. */
import { RESOURCE_TYPES } from '@/lib/lab/communityRules';
import type { ResourceLink, ResourceLinkInput, ResourceType } from '@/lib/lab/labTypes';
import { parseYmd } from '@/lib/lab/labDate';

export const MAX_INSTITUTION = 100;
export const MAX_CONTACT_PERSON = 50;
export const MAX_RESOURCE_CONTENT = 2000;
export const MAX_RESOURCE_OUTCOME = 1000;
export const MAX_WRITER_NAME = 50;

/** 선택기에서 "기관 전체"를 가리키는 값 */
export const ALL_ELDERS = 'ALL';

export const RESOURCE_OPTIONS = RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }));

export interface ResourceDraft {
  id: number | null;
  /** 기관 전체 연계면 null */
  elderlyId: number | null;
  linkedOn: string;
  resourceType: ResourceType;
  institution: string;
  contactPerson: string;
  content: string;
  outcome: string;
  followUpOn: string;
  referralGiven: boolean;
  writer: string;
  /** AI 제안을 받아 자원 종류를 채웠는지 */
  aiAssisted: boolean;
}

export function emptyResourceDraft(date: string, writer: string): ResourceDraft {
  return { id: null, elderlyId: null, linkedOn: date, resourceType: 'MEDICAL', institution: '', contactPerson: '', content: '', outcome: '', followUpOn: '', referralGiven: false, writer, aiAssisted: false };
}

export function draftOfResource(l: ResourceLink): ResourceDraft {
  return {
    id: l.id,
    elderlyId: l.elderlyId,
    linkedOn: l.linkedOn,
    resourceType: l.resourceType,
    institution: l.institution,
    contactPerson: l.contactPerson ?? '',
    content: l.content,
    outcome: l.outcome ?? '',
    followUpOn: l.followUpOn ?? '',
    referralGiven: l.referralGiven,
    writer: l.writerName,
    aiAssisted: l.aiAssisted,
  };
}

const orNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

export function inputOfResourceDraft(d: ResourceDraft): ResourceLinkInput {
  return {
    elderlyId: d.elderlyId,
    linkedOn: d.linkedOn,
    resourceType: d.resourceType,
    institution: d.institution.trim(),
    contactPerson: orNull(d.contactPerson),
    content: d.content.trim(),
    outcome: orNull(d.outcome),
    followUpOn: orNull(d.followUpOn),
    referralGiven: d.referralGiven,
    writerName: d.writer.trim(),
    aiAssisted: d.aiAssisted,
  };
}

export function resourceIssues(d: ResourceDraft): string[] {
  const issues: string[] = [];
  if (!parseYmd(d.linkedOn)) issues.push('연계 날짜를 골라 주세요');
  if (d.institution.trim() === '') issues.push('연계한 기관 이름을 적어 주세요');
  if (d.content.trim() === '') issues.push('연계한 내용을 적어 주세요');
  if (d.followUpOn !== '' && parseYmd(d.followUpOn) && parseYmd(d.linkedOn) && d.followUpOn < d.linkedOn) issues.push('후속 확인 예정일은 연계 날짜보다 앞설 수 없습니다');
  if (d.writer.trim() === '') issues.push('작성자 이름을 적어 주세요');
  return issues;
}
