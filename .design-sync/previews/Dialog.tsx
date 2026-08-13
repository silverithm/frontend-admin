import { Dialog, DialogHeader, Layout, LayoutContent, LayoutFooter, VStack, HStack, Button, Text, TextInput } from '@astryxdesign/core';

export const FormDialog = () => (
  <Dialog isOpen onOpenChange={() => {}} purpose="form" width={420}>
    <Layout
      header={<DialogHeader title="일정 추가" onOpenChange={() => {}} />}
      content={
        <LayoutContent>
          <VStack gap={4}>
            <TextInput label="제목" value="어르신 생신잔치" onChange={() => {}} />
            <TextInput label="장소" value="프로그램실" onChange={() => {}} />
            <Text type="supporting">참석자와 담당자는 저장 후에도 바꿀 수 있습니다.</Text>
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter hasDivider>
          <HStack gap={2} hAlign="end">
            <Button label="취소" variant="secondary" />
            <Button label="저장" variant="primary" />
          </HStack>
        </LayoutFooter>
      }
    />
  </Dialog>
);

export const InfoDialog = () => (
  <Dialog isOpen onOpenChange={() => {}} purpose="info" width={380}>
    <Layout
      header={<DialogHeader title="8월 21일 (목)" subtitle="일정 2건 · 휴무 2명" onOpenChange={() => {}} />}
      content={
        <LayoutContent>
          <VStack gap={2} align="start">
            <Text type="body">오전 10시 — 어르신 체조</Text>
            <Text type="body">오후 2시 — 생신잔치 준비</Text>
            <Text type="supporting">휴무: 요양보호사 김영희, 박민수</Text>
          </VStack>
        </LayoutContent>
      }
    />
  </Dialog>
);
