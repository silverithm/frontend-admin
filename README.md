# Frontend Admin - 휴무 관리 시스템

Spring Boot 백엔드와 연동되는 휴무 관리 시스템의 관리자 인터페이스입니다.

## 환경 설정

프로젝트를 실행하기 전에 환경변수를 설정해야 합니다.

### 1. 환경변수 파일 생성

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# 백엔드 API URL (Spring Boot 서버)
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 2. 백엔드 서버 연결

이 프론트엔드는 Spring Boot 백엔드 서버와 연동됩니다:
- 백엔드 서버가 `http://localhost:8080`에서 실행되어야 합니다
- 다음 API 엔드포인트들이 구현되어야 합니다:
  - `GET /api/vacation/calendar` - 휴무 캘린더 데이터
  - `GET /api/vacation/date/{date}` - 특정 날짜 휴무 데이터
  - `POST /api/vacation/submit` - 휴무 신청
  - `PUT /api/vacation/approve/{id}` - 휴무 승인
  - `PUT /api/vacation/reject/{id}` - 휴무 거부
  - `DELETE /api/vacation/delete/{id}` - 휴무 삭제
  - `GET /api/vacation/requests` - 모든 휴무 요청
  - `GET /api/vacation/limits` - 휴무 제한 조회
  - `POST /api/vacation/limits` - 휴무 제한 설정
  - `POST /api/v1/members/signin` - 로그인
  - `GET /api/v1/members/join-requests/pending` - 대기중인 가입 요청

## Getting Started

환경변수 설정 후 개발 서버를 실행하세요:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## 주요 기능

- **휴무 캘린더**: 월별 휴무 현황 확인
- **역할별 필터링**: 요양보호사/사무직 구분 표시
- **휴무 신청 관리**: 승인/거부/삭제 기능
- **휴무 제한 설정**: 일자별 최대 인원 제한
- **사용자 관리**: 가입 요청 승인/거부
- **실시간 업데이트**: 자동 새로고침 기능

## 기술 스택

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Animation**: Framer Motion
- **Icons**: React Icons
- **Date Handling**: date-fns
- **Backend**: Spring Boot (별도 프로젝트)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

배포 시 환경변수를 올바르게 설정해야 합니다:
- `NEXT_PUBLIC_API_URL`: 프로덕션 백엔드 서버 URL

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
