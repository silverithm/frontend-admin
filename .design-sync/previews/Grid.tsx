import { Grid, GridSpan, Card, Text, VStack } from '@astryxdesign/core';

export const TwoColumns = () => (
  <div style={{ width: 420 }}>
    <Grid columns={2} gap={3}>
      <Card padding={3}><Text type="supporting">출근 24명</Text></Card>
      <Card padding={3}><Text type="supporting">휴무 2명</Text></Card>
      <Card padding={3}><Text type="supporting">일정 3건</Text></Card>
      <Card padding={3}><Text type="supporting">결재 1건</Text></Card>
    </Grid>
  </div>
);

export const WithSpan = () => (
  <div style={{ width: 420 }}>
    <Grid columns={3} gap={3}>
      <GridSpan columns={3}>
        <Card padding={3}><Text type="body" weight="medium">이번 달 요약 (3칸 전체)</Text></Card>
      </GridSpan>
      <Card padding={3}><Text type="supporting">공지</Text></Card>
      <Card padding={3}><Text type="supporting">결재</Text></Card>
      <Card padding={3}><Text type="supporting">소식</Text></Card>
    </Grid>
  </div>
);
