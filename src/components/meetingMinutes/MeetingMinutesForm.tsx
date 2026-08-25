'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FiZap } from 'react-icons/fi';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Divider } from '@astryxdesign/core/Divider';
import { FileInput } from '@astryxdesign/core/FileInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TimeInput } from '@astryxdesign/core/TimeInput';
import { Text } from '@astryxdesign/core/Text';
import { Grid } from '@astryxdesign/core/Grid';
import { HStack, StackItem, VStack } from '@astryxdesign/core/Stack';
import AttendeeSelector from '@/components/meetingMinutes/AttendeeSelector';
import MeetingRecorder, { RecorderPhase } from '@/components/meetingMinutes/MeetingRecorder';
import {
  createMeetingMinutes,
  registerMeetingMinutes,
  summarizeMeetingMinutes,
  updateMeetingMinutes,
  uploadFileToServer,
} from '@/lib/apiService';
import {
  CreateMeetingMinutesInput,
  MeetingMinutes,
  MinutesAttendeeEntry,
  MinutesSection,
  MinutesSectionContent,
} from '@/types/meetingMinutes';

interface MeetingMinutesFormProps {
  /** 기관 양식(섹션 구성) — 새 회의록의 뼈대 */
  templateSections: MinutesSection[];
  /** 수정 모드면 기존 회의록 */
  initial: MeetingMinutes | null;
  onDone: (minutes: MeetingMinutes, registered: boolean) => void;
  onNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

/** 로컬 기준 오늘 날짜 — toISOString은 UTC라 자정 전후로 어제 날짜가 나온다 */
function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toDatePart(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : todayLocal();
}

function toTimePart(iso: string | null | undefined): string {
  if (!iso || iso.length < 16) return '';
  return iso.slice(11, 16);
}

/** 문서의 섹션 스냅샷이 있으면 그걸, 없으면 기관 양식으로 빈 내용을 만든다 */
function initialSections(initial: MeetingMinutes | null, template: MinutesSection[]): MinutesSectionContent[] {
  if (initial?.sectionsJson) {
    try {
      const parsed = JSON.parse(initial.sectionsJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* 깨진 스냅샷이면 양식으로 */ }
  }
  return template.map((section) => ({ ...section, content: '' }));
}

function initialAttendees(initial: MeetingMinutes | null): MinutesAttendeeEntry[] {
  if (!initial?.attendees) return [];
  return initial.attendees.map((attendee) =>
    attendee.attendeeType === 'EXTERNAL'
      ? { attendeeType: 'EXTERNAL', name: attendee.attendeeName }
      : { attendeeType: attendee.attendeeType, refId: attendee.refId },
  );
}

/**
 * 회의록 작성 화면.
 * 회의 중에는 녹음(실시간 자막)과 메모를 쌓고, 끝나면 AI 자동 정리로 섹션별 개조식 회의록을 만든 뒤
 * 등록해 참석자들에게 서명 요청을 보낸다.
 */
export default function MeetingMinutesForm({
  templateSections,
  initial,
  onDone,
  onNotification,
}: MeetingMinutesFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [date, setDate] = useState(toDatePart(initial?.meetingStartAt));
  const [startTime, setStartTime] = useState(toTimePart(initial?.meetingStartAt) || '10:00');
  const [endTime, setEndTime] = useState(toTimePart(initial?.meetingEndAt));
  const [attendees, setAttendees] = useState<MinutesAttendeeEntry[]>(initialAttendees(initial));
  const [sections, setSections] = useState<MinutesSectionContent[]>(
    () => initialSections(initial, templateSections),
  );
  const [rawNotes, setRawNotes] = useState(initial?.rawNotes ?? '');
  const [transcript, setTranscript] = useState(initial?.transcript ?? '');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [minutesId, setMinutesId] = useState<number | null>(initial?.id ?? null);
  const [recorderPhase, setRecorderPhase] = useState<RecorderPhase>('idle');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);

  // 녹음 시작 시 자동 생성에서 최신 입력값을 쓰기 위한 참조
  const stateRef = useRef({ title, location, date, startTime, endTime, attendees, sections, rawNotes });
  stateRef.current = { title, location, date, startTime, endTime, attendees, sections, rawNotes };

  const existingAttachments = useMemo(
    () => initial?.attachments ?? [],
    [initial],
  );

  const buildInput = useCallback(async (uploadNewFiles: boolean): Promise<CreateMeetingMinutesInput> => {
    const state = stateRef.current;
    const attachments = existingAttachments.map((attachment) => ({
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
    }));

    if (uploadNewFiles) {
      for (const file of newFiles) {
        const uploaded = await uploadFileToServer(file, { category: 'meetings' });
        attachments.push({
          fileUrl: uploaded.filePath,
          fileName: uploaded.fileName || file.name,
          fileSize: uploaded.fileSize ?? file.size,
        });
      }
    }

    return {
      title: state.title.trim() || `${new Date(state.date).getMonth() + 1}월 ${new Date(state.date).getDate()}일 회의`,
      location: state.location.trim() || null,
      meetingStartAt: `${state.date}T${state.startTime || '00:00'}:00`,
      meetingEndAt: state.endTime ? `${state.date}T${state.endTime}:00` : null,
      sectionsJson: JSON.stringify(state.sections),
      rawNotes: state.rawNotes || null,
      attendees: state.attendees,
      attachments,
    };
  }, [existingAttachments, newFiles]);

  /** 녹음 시작 시점 — 회의록이 아직 없으면 지금 내용으로 만들어 조각·전사를 붙일 곳을 확보한다 */
  const ensureMinutesId = useCallback(async (): Promise<number> => {
    if (minutesId) return minutesId;
    const input = await buildInput(false);
    const created = await createMeetingMinutes(input);
    setMinutesId(created.id);
    return created.id;
  }, [minutesId, buildInput]);

  const runAiSummarize = useCallback(async () => {
    if (!rawNotes.trim() && !transcript.trim()) {
      onNotification('회의 메모를 적거나 녹음을 진행한 뒤 눌러주세요.', 'info');
      return;
    }
    setAiLoading(true);
    try {
      const result = await summarizeMeetingMinutes({
        sections: sections.map(({ key, label }) => ({ key, label })),
        rawNotes,
        transcript,
        title,
      });
      if (result.length > 0) {
        setSections(result);
        onNotification('섹션별로 정리했어요. 원문 메모와 자막은 그대로 보관됩니다.', 'success');
      }
    } catch (error) {
      onNotification(error instanceof Error ? error.message : 'AI 정리에 실패했어요. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setAiLoading(false);
    }
  }, [rawNotes, transcript, sections, title, onNotification]);

  const save = useCallback(async (registered: boolean) => {
    if (registered && attendees.length === 0) {
      onNotification('등록하려면 참석자를 한 명 이상 지정해 주세요.', 'error');
      return;
    }
    if (recorderPhase !== 'idle') {
      onNotification('녹음을 먼저 종료해 주세요. 종료 후 저장·등록할 수 있습니다.', 'info');
      return;
    }

    const setBusy = registered ? setRegistering : setSaving;
    setBusy(true);
    try {
      const input = await buildInput(true);
      let saved: MeetingMinutes;
      if (minutesId) {
        saved = await updateMeetingMinutes(minutesId, input);
      } else {
        saved = await createMeetingMinutes(input);
        setMinutesId(saved.id);
      }

      if (registered) {
        saved = await registerMeetingMinutes(saved.id);
        onNotification('회의록을 등록하고 참석자들에게 서명 요청 알림을 보냈어요.', 'success');
      } else {
        onNotification('저장했어요. 등록 전까지는 참석자에게 알림이 가지 않습니다.', 'success');
      }
      setNewFiles([]);
      onDone(saved, registered);
    } catch (error) {
      onNotification(error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setBusy(false);
    }
  }, [attendees.length, recorderPhase, buildInput, minutesId, onDone, onNotification]);

  return (
    <VStack gap={4}>
      {/* 기본 정보 */}
      <Grid columns={2} gap={3}>
        <TextInput
          label="주제"
          isRequired
          value={title}
          onChange={(value) => setTitle(value)}
          placeholder="예: 8월 4주차 전체 회의"
        />
        <TextInput
          label="회의 장소"
          value={location}
          onChange={(value) => setLocation(value)}
          placeholder="예: 2층 프로그램실"
        />
      </Grid>
      <Grid columns={3} gap={3}>
        <DateInput
          label="회의 날짜"
          isRequired
          value={date ? (date as never) : undefined}
          onChange={(value) => setDate(value || todayLocal())}
        />
        <TimeInput
          label="시작 시간"
          hourFormat="24h"
          value={startTime ? (startTime as never) : undefined}
          onChange={(value) => setStartTime(value || '')}
        />
        <TimeInput
          label="종료 시간"
          hourFormat="24h"
          value={endTime ? (endTime as never) : undefined}
          onChange={(value) => setEndTime(value || '')}
        />
      </Grid>

      <Divider />

      {/* 회의 녹음 + 실시간 자막 */}
      <VStack gap={1}>
        <Text type="label" weight="medium" color="primary">회의 녹음</Text>
        <Text type="supporting" color="secondary">
          녹음하면 말이 실시간 자막으로 쌓이고, 원본 녹음은 1분 단위로 자동 저장됩니다.
          끝나고 AI 자동 정리를 누르면 자막과 메모가 섹션별 회의록으로 정리돼요.
        </Text>
      </VStack>
      <MeetingRecorder
        minutesId={minutesId}
        ensureMinutesId={ensureMinutesId}
        transcript={transcript}
        onTranscriptChange={setTranscript}
        onPhaseChange={setRecorderPhase}
        onNotification={onNotification}
      />

      {/* 회의 메모 (원문) */}
      <TextArea
        label="회의 메모"
        value={rawNotes}
        onChange={(value) => setRawNotes(value)}
        placeholder="회의 중 자유롭게 받아 적으세요. 마지막에 AI 자동 정리가 섹션별로 정리해 줍니다."
        rows={5}
      />

      {/* AI 자동 정리 */}
      <HStack gap={2} vAlign="center">
        <Button
          label="AI 자동 정리"
          variant="primary"
          icon={<FiZap />}
          isLoading={aiLoading}
          onClick={() => void runAiSummarize()}
        />
        <Text type="supporting" color="secondary">
          메모·자막을 아래 섹션에 개조식으로 정리합니다. 원문은 지워지지 않아요.
        </Text>
      </HStack>

      {/* 섹션별 내용 */}
      <VStack gap={3}>
        {sections.map((section, index) => (
          <TextArea
            key={section.key}
            label={`[${section.label}]`}
            value={section.content}
            onChange={(value) =>
              setSections((prev) => prev.map((s, i) => (i === index ? { ...s, content: value } : s)))
            }
            placeholder="* 항목을 개조식으로 적습니다."
            rows={4}
          />
        ))}
      </VStack>

      <Divider />

      {/* 참석자 */}
      <AttendeeSelector value={attendees} onChange={setAttendees} />

      <Divider />

      {/* 자료 첨부 */}
      <VStack gap={2}>
        {existingAttachments.length > 0 && (
          <VStack gap={1}>
            {existingAttachments.map((attachment) => (
              <Text key={attachment.id} type="supporting" color="secondary">
                첨부됨: {attachment.fileName}
              </Text>
            ))}
          </VStack>
        )}
        <FileInput
          label="자료 첨부"
          mode="dropzone"
          isMultiple
          value={newFiles}
          onChange={(files) => setNewFiles(Array.isArray(files) ? files : files ? [files] : [])}
          description="회의 자료를 끌어다 놓거나 눌러서 올리세요. (파일당 최대 50MB)"
        />
      </VStack>

      {minutesId !== null && initial?.status === 'REGISTERED' && (
        <Banner
          status="info"
          container="section"
          title="이미 서명 수집 중인 회의록입니다."
          description="내용을 고치면 참석자들이 보는 회의록에도 반영됩니다."
        />
      )}

      {/* 동작 버튼 */}
      <HStack gap={2} hAlign="end">
        <Button
          label="저장"
          variant="secondary"
          isLoading={saving}
          isDisabled={registering}
          onClick={() => void save(false)}
        />
        <Button
          label={initial?.status === 'REGISTERED' ? '저장 (서명 수집 중)' : '등록하고 서명 요청'}
          variant="primary"
          isLoading={registering}
          isDisabled={saving}
          onClick={() => void save(initial?.status !== 'REGISTERED')}
        />
      </HStack>
    </VStack>
  );
}
