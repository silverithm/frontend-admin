import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell, Badge, Text } from '@astryxdesign/core';

export const Roster = () => (
  <div style={{ width: 520 }}>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>이름</TableHeaderCell>
          <TableHeaderCell>직종</TableHeaderCell>
          <TableHeaderCell>날짜</TableHeaderCell>
          <TableHeaderCell>상태</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>김영희</TableCell>
          <TableCell>요양보호사</TableCell>
          <TableCell>8월 21일</TableCell>
          <TableCell><Badge variant="orange" label="대기" /></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>박민수</TableCell>
          <TableCell>요양보호사</TableCell>
          <TableCell>8월 22일</TableCell>
          <TableCell><Badge variant="teal" label="승인" /></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>이철수</TableCell>
          <TableCell>사회복지사</TableCell>
          <TableCell>8월 25일</TableCell>
          <TableCell><Badge variant="error" label="반려" /></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
);

export const Numeric = () => (
  <div style={{ width: 420 }}>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHeaderCell>월</TableHeaderCell>
          <TableHeaderCell>근무일</TableHeaderCell>
          <TableHeaderCell>휴무일</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>6월</TableCell>
          <TableCell><Text type="body" hasTabularNumbers>22</Text></TableCell>
          <TableCell><Text type="body" hasTabularNumbers>8</Text></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>7월</TableCell>
          <TableCell><Text type="body" hasTabularNumbers>23</Text></TableCell>
          <TableCell><Text type="body" hasTabularNumbers>8</Text></TableCell>
        </TableRow>
        <TableRow>
          <TableCell>8월</TableCell>
          <TableCell><Text type="body" hasTabularNumbers>21</Text></TableCell>
          <TableCell><Text type="body" hasTabularNumbers>10</Text></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
);
