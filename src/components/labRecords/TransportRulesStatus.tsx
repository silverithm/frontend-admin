'use client';

/** 이동서비스 수칙 문서 — 규정·지침 대장의 TRANSPORT_RULES를 읽어 네 필수 항목과 개정일을 보여 준다. 여기서 고치지 않는다. */
import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import type { PolicyDoc } from '@/lib/lab/labTypes';
import { docStatus } from '@/lib/lab/policyDocRules';
import { TRANSPORT_RULE_ITEMS } from '@/lib/lab/transportRules';
import { Chip } from '@/components/lab/LabUi';
import { dotDate } from '@/components/lab/labFormat';
import own from './Transport.module.css';

export default function TransportRulesStatus({ doc, today }: { doc: PolicyDoc | null; today: string }) {
  if (doc === null) {
    return (
      <div className={own.noticeBox}>
        <Text type="label">이동서비스 수칙이 아직 등록되지 않았습니다</Text>
        <Text type="supporting">규정·지침 화면에서 이동서비스 수칙을 먼저 등록해 주세요. 등록하면 네 가지 필수 항목과 개정일을 여기서 확인하고, 수칙이 바뀐 뒤 다시 제공해야 할 어르신도 가려 드립니다.</Text>
      </div>
    );
  }
  const status = docStatus(doc, today);
  return (
    <Card padding={4}>
      <div className={own.chipRow}>
        <Text type="large" weight="semibold">
          {doc.title}
        </Text>
        <Chip tone={status.complete ? 'ok' : 'warn'} label={status.complete ? '필수 항목 모두 있음' : `필수 항목 ${status.itemsTotal - status.itemsChecked}개 빠짐`} />
      </div>
      <div className={own.chipRow}>
        {TRANSPORT_RULE_ITEMS.map((item) => (
          <Chip key={item.key} tone={doc.checks[item.key] === true ? 'ok' : 'warn'} label={`${item.label} ${doc.checks[item.key] === true ? '확인' : '없음'}`} />
        ))}
      </div>
      <Text type="supporting" color="secondary">
        최근 개정일 {doc.revisedOn ? dotDate(doc.revisedOn) : '입력 안 됨'}
        {doc.revisedOn && !status.revisedWithin12m ? ' (1년 넘음)' : ''} · 비치 장소 {doc.location?.trim() || '입력 안 됨'}
      </Text>
      <Text type="supporting" color="secondary">
        수칙에는 운전자 자격요건·동승자의 역할·차량안전수칙·사고 시 조치사항이 들어가야 하고, 수칙이 바뀌면 어르신·보호자에게 다시 제공해야 합니다. 항목 체크와 개정일은 규정·지침 화면에서 고칩니다.
      </Text>
    </Card>
  );
}
