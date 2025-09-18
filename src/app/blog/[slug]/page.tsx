'use client';

import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface BlogPost {
    slug: string;
    title: string;
    category: string;
    date: string;
    readTime: string;
    content: string;
    keywords: string[];
}

const blogPosts: Record<string, BlogPost> = {
    "carev-update-2024-12": {
        slug: "carev-update-2024-12",
        title: "케어브이 12월 업데이트: 연차 관리 기능 대폭 강화",
        category: "업데이트",
        date: "2024.12.15",
        readTime: "3분",
        keywords: ["연차관리", "업데이트", "휴가캘린더", "케어브이"],
        content: `
## 🎉 12월 대규모 업데이트 소개

케어브이가 더욱 강력한 연차 관리 기능과 함께 돌아왔습니다! 이번 업데이트는 많은 고객분들이 요청해주신 기능들을 중심으로 준비했습니다.

### 📅 연차 자동 계산 기능

이제 직원의 입사일을 기준으로 연차가 자동으로 계산됩니다.
- **자동 연차 생성**: 매년 1월 1일 기준으로 연차 자동 부여
- **월차 관리**: 1년 미만 직원의 월차도 자동 계산
- **연차 촉진**: 사용하지 않은 연차에 대한 자동 알림

### 🗓️ 휴가 캘린더 뷰

팀 전체의 휴가 일정을 한눈에 확인할 수 있습니다.
- **월간/주간 뷰**: 원하는 기간으로 휴가 현황 확인
- **부서별 필터**: 특정 부서의 휴가만 선택해서 보기
- **색상 구분**: 연차, 반차, 병가 등 휴가 유형별 색상 표시

### 📊 잔여 연차 실시간 확인

직원들이 자신의 잔여 연차를 실시간으로 확인할 수 있습니다.
- **모바일 대시보드**: 언제든지 잔여 연차 확인
- **사용 내역**: 과거 휴가 사용 이력 조회
- **예정 휴가**: 승인된 미래 휴가 일정 확인

### 🔔 스마트 알림 기능 강화

휴가 관련 모든 프로세스에 스마트 알림이 추가되었습니다.
- **신청 알림**: 직원이 휴가 신청 시 관리자에게 즉시 알림
- **승인 알림**: 휴가 승인/반려 시 직원에게 푸시 알림
- **리마인더**: 휴가 전날 자동 리마인더 발송

### 💡 추가 개선사항

- 공휴일 자동 반영 (2025년 달력 업데이트)
- 휴가 사유 입력 기능 개선

## 앞으로의 계획

계속해서 여러분의 의견을 반영하여 더 나은 근무표 관리 서비스를 만들어가겠습니다.

**피드백은 언제나 환영입니다! ggprgrkjh@naver.com로 의견을 보내주세요.**
        `
    },
    "shift-schedule-tips": {
        slug: "shift-schedule-tips",
        title: "효율적인 근무표 작성을 위한 5가지 실전 팁",
        category: "활용팁",
        date: "2024.12.10",
        readTime: "5분",
        keywords: ["근무표작성", "스케줄관리", "팁", "효율화"],
        content: `
## 근무표 작성, 이렇게 하면 쉬워집니다!

매달 근무표 작성에 시간을 많이 쏟고 계신가요? 케어브이를 활용한 효율적인 근무표 작성 노하우를 공유합니다.

### 1. 🎯 패턴 템플릿 활용하기

반복되는 근무 패턴을 템플릿으로 저장하세요.
- **주간 패턴 저장**: 자주 사용하는 주간 근무 패턴을 템플릿화
- **복사 & 붙여넣기**: 이전 달 근무표를 기반으로 빠른 작성
- **직무별 템플릿**: 직무 특성에 맞는 근무 패턴 사전 정의

### 2. 📊 공평한 근무 배분

케어브이의 통계 기능으로 공평한 근무를 보장하세요.
- **근무 시간 자동 집계**: 직원별 월간 근무 시간 실시간 확인
- **주말 근무 균등 배분**: 주말/공휴일 근무 횟수 자동 계산
- **야간 근무 로테이션**: 야간 근무 순번 자동 관리

### 3. 🤝 직원 선호도 반영

직원 만족도를 높이는 스마트한 근무표 작성법입니다.
- **희망 근무일 신청**: 직원이 선호하는 근무일 사전 수집
- **휴무 희망일 우선 반영**: 중요한 개인 일정 고려
- **근무 교대 요청**: 직원 간 자율적인 근무 교대 시스템

### 4. ⚡ 자동화 기능 활용

수동 작업을 최소화하고 자동화를 최대한 활용하세요.
- **연차 자동 반영**: 승인된 휴가 자동으로 근무표에 반영
- **공휴일 자동 표시**: 대한민국 공휴일 자동 반영

### 5. 📱 실시간 소통과 조정

변경사항을 즉시 반영하고 공유하세요.
- **실시간 알림**: 근무표 변경 시 해당 직원에게 즉시 알림
- **모바일 확인**: 언제 어디서나 근무표 확인 가능
- **변경 이력 관리**: 모든 수정 사항 자동 기록

## 💡 보너스 팁: 월말 체크리스트

✅ 다음 달 공휴일 확인
✅ 직원 휴가 신청 마감
✅ 특별 근무(교육, 출장 등) 일정 확인
✅ 이번 달 근무 통계 리뷰
✅ 직원 피드백 수집

이러한 팁들을 활용하면 근무표 작성 시간을 50% 이상 단축할 수 있습니다!
        `
    },
    "vacation-request-guide": {
        slug: "vacation-request-guide",
        title: "케어브이 휴무 신청 완벽 가이드",
        category: "가이드",
        date: "2024.12.05",
        readTime: "4분",
        keywords: ["휴무신청", "모바일", "가이드", "승인프로세스"],
        content: `
## 📱 모바일에서 3초만에 휴무 신청하기

케어브이의 간편한 휴무 신청 기능을 단계별로 안내해드립니다.

### 직원용 가이드

#### Step 1: 케어브이 앱 실행
- iOS/Android 앱 또는 웹브라우저에서 케어브이 접속
- 직원 계정으로 로그인

#### Step 2: 휴무 신청 메뉴 선택
- 하단 메뉴에서 '휴무 신청' 탭 클릭
- 또는 대시보드의 '+ 휴무 신청' 버튼 클릭

#### Step 3: 휴무 정보 입력
- **휴무 유형 선택**: 연차, 반차(오전/오후), 병가, 경조사 등
- **날짜 선택**: 캘린더에서 원하는 날짜 선택
- **사유 입력**: 간단한 휴무 사유 작성

#### Step 4: 신청 완료
- '신청하기' 버튼 클릭
- 관리자에게 자동으로 알림 발송

### 관리자용 가이드

#### 휴무 승인 프로세스

1. **알림 확인**
   - 푸시 알림 또는 이메일로 휴무 신청 알림 수신
   - 케어브이 관리자 대시보드에서 대기 중인 신청 확인

2. **신청 내용 검토**
   - 해당 날짜의 인력 현황 자동 표시
   - 최소 인원 기준 충족 여부 확인
   - 동일 부서 휴무자 현황 확인

3. **승인/반려 결정**
   - ✅ 승인: 문제없을 경우 '승인' 버튼 클릭
   - ❌ 반려: 반려 사유와 함께 '반려' 버튼 클릭
   - 💬 보류: 추가 확인이 필요한 경우 코멘트 작성

### 🎯 꿀팁 모음

#### 연차 사용 계획 세우기
- 연초에 연간 휴가 계획을 미리 등록
- 성수기/비수기를 고려한 전략적 휴가 사용
- 동료들과 휴가 일정 사전 조율

#### 긴급 휴무 신청
- 당일 병가: 모바일 앱으로 즉시 신청
- 증빙서류: 나중에 업로드 가능
- 관리자 전화 연락 후 앱으로 정식 신청

#### 휴가 캘린더 활용
- 팀 전체 휴가 현황 미리 확인
- 휴가 집중 기간 피하기
- 업무 인수인계 일정 조율

### 자주 묻는 질문

**Q: 휴무 신청을 취소하려면?**
A: '내 휴무' 메뉴에서 해당 신청 선택 후 '취소' 버튼 클릭

**Q: 반차는 어떻게 신청하나요?**
A: 휴무 유형에서 '오전 반차' 또는 '오후 반차' 선택

**Q: 대체 휴무는 어떻게 처리하나요?**
A: 공휴일 근무 후 '대체휴무' 유형으로 신청

케어브이와 함께라면 복잡한 휴무 관리도 간단해집니다!
        `
    },
    "team-communication-features": {
        slug: "team-communication-features",
        title: "팀 소통을 위한 케어브이 알림 기능 활용법",
        category: "기능소개",
        date: "2024.11.30",
        readTime: "3분",
        keywords: ["알림기능", "팀소통", "공지사항", "실시간알림"],
        content: `
## 🔔 놓치는 정보 없이, 완벽한 팀 소통

케어브이의 스마트 알림 시스템으로 팀 커뮤니케이션을 한 단계 업그레이드하세요.

### 알림 유형별 가이드

#### 1. 근무 관련 알림
- **근무표 게시**: 새로운 근무표가 등록되면 전 직원에게 푸시
- **근무 변경**: 본인 근무 시간이 변경되면 즉시 알림
- **교대 요청**: 동료의 근무 교대 요청 실시간 수신

#### 2. 휴무 관련 알림
- **휴무 승인/반려**: 신청한 휴무의 처리 결과 즉시 확인
- **연차 촉진**: 사용하지 않은 연차 소멸 전 리마인더
- **대체 근무 요청**: 휴무자 발생 시 대체 근무 요청 알림

#### 3. 공지사항 알림
- **전체 공지**: 중요 공지사항 전 직원 동시 전달
- **부서별 공지**: 해당 부서만 선택적 알림
- **긴급 공지**: 긴급 상황 시 강제 푸시 알림

### 알림 커스터마이징

#### 개인별 알림 설정

설정 > 알림 관리에서 조정 가능:
- ✅ 근무 변경 알림
- ✅ 휴무 승인 알림
- ✅ 공지사항 알림
- ✅ 근무 리마인더
- ✅ 생일/기념일 알림

#### 알림 시간대 설정
- 근무 시간 내 알림
- 24시간 알림
- 방해 금지 시간 설정

### 관리자 전용 기능

#### 📊 알림 통계
- 알림 수신율 확인
- 미확인 알림 직원 리스트
- 알림별 반응 시간 측정

#### 📨 타겟 알림
- 특정 직급만 선택
- 특정 근무조만 선택
- 커스텀 그룹 생성

### 효과적인 알림 활용 팁

1. **중요도 구분하기**
   - 🔴 긴급: 즉시 확인 필요
   - 🟡 중요: 당일 내 확인
   - 🟢 일반: 편한 시간에 확인

2. **알림 피로도 줄이기**
   - 꼭 필요한 알림만 활성화
   - 부서별/팀별 단계적 전달
   - 정기 알림은 특정 시간에 모아서

3. **양방향 소통 활성화**
   - 알림에 대한 확인 버튼
   - 간단한 피드백 기능
   - 추가 문의 연결

### 실제 활용 사례

**사례 1: A요양원**
> "근무 변경 알림 덕분에 실수가 90% 감소했습니다."

**사례 2: B주간보호센터**
> "공지사항 전달 시간이 10분의 1로 단축되었습니다."

**사례 3: C재가센터**
> "긴급 상황 대응 시간이 크게 개선되었습니다."

케어브이 알림 기능으로 더 나은 팀워크를 만들어보세요!
        `
    },
    "monthly-schedule-export": {
        slug: "monthly-schedule-export",
        title: "월간 근무표 엑셀 다운로드 및 인쇄 기능 안내",
        category: "기능소개",
        date: "2024.11.25",
        readTime: "3분",
        keywords: ["엑셀다운로드", "인쇄", "월간근무표", "보고서"],
        content: `
## 📑 근무표를 엑셀로, 인쇄로 자유롭게!

케어브이에서 작성한 근무표를 다양한 형식으로 내보내고 활용하는 방법을 소개합니다.

### 엑셀 다운로드 기능

#### 다운로드 방법
1. 근무표 메뉴 접속
2. 원하는 월 선택
3. 우측 상단 '다운로드' 버튼 클릭
4. 파일 형식 선택 (Excel, CSV, PDF)

#### 포함 정보
- 직원별 월간 근무 일정
- 근무 시간 합계
- 휴무 현황
- 초과근무 내역
- 부서별 통계

### 인쇄 최적화 기능

#### 인쇄 설정
- **용지 방향**: 가로/세로 자동 최적화
- **용지 크기**: A4, A3 선택 가능
- **여백 조정**: 자동 여백 또는 수동 설정
- **색상 옵션**: 컬러/흑백 선택

#### 인쇄 레이아웃 옵션
1. **전체 보기**: 한 페이지에 전체 월간 일정
2. **주간 분할**: 주 단위로 나누어 인쇄
3. **개인별 인쇄**: 직원별 개별 근무표
4. **부서별 인쇄**: 부서 단위 근무표

### 활용 시나리오

#### 📌 게시판 부착용
- A3 크기로 인쇄
- 컬러 인쇄로 가독성 향상
- 주요 정보 강조 표시

#### 📊 보고서 작성용
- 엑셀로 다운로드
- 추가 분석 및 차트 생성
- 경영진 보고 자료 활용

#### 📱 개인 배포용
- 개인별 근무표 PDF 생성
- 이메일/메신저로 전송
- 모바일에서도 확인 가능

### 고급 기능

#### 커스텀 템플릿
- 회사 로고 삽입
- 커스텀 헤더/푸터
- 기업 CI 컬러 적용

#### 자동화 설정
- 매월 자동 생성
- 지정 이메일로 자동 발송
- 클라우드 자동 백업

### 자주 사용하는 엑셀 기능

#### 필터링
- 특정 직원만 표시
- 특정 날짜 범위 선택
- 근무 유형별 분류

#### 피벗 테이블
- 부서별 근무 시간 집계
- 요일별 인력 분석
- 초과근무 통계

#### 조건부 서식
- 주말 근무 색상 표시
- 초과근무 강조
- 휴무 패턴 시각화

### 💡 Pro Tips

1. **정기 백업**: 매월 말 자동 백업 설정
2. **버전 관리**: 수정 전 원본 보관
3. **공유 설정**: 읽기 전용으로 공유
4. **보안 설정**: 민감 정보 암호화

케어브이의 다운로드 기능으로 근무표 관리가 더욱 편리해집니다!
        `
    },
    "carev-mobile-app-launch": {
        slug: "carev-mobile-app-launch",
        title: "케어브이 모바일 앱 정식 출시! iOS/Android 동시 지원",
        category: "공지사항",
        date: "2024.11.20",
        readTime: "2분",
        keywords: ["모바일앱", "iOS", "Android", "출시"],
        content: `
## 📱 드디어 출시! 케어브이 모바일 앱

기다려주신 여러분께 감사드립니다. 케어브이 모바일 앱이 정식 출시되었습니다!

### 다운로드 방법

#### iOS (iPhone/iPad)
1. App Store 접속
2. '케어브이' 또는 'CareV' 검색
3. '받기' 버튼 클릭하여 설치
4. 기존 계정으로 로그인

#### Android
1. Google Play Store 접속
2. '케어브이' 또는 'CareV' 검색
3. '설치' 버튼 클릭
4. 기존 계정으로 로그인

### 주요 기능

#### 👨‍💼 직원용 기능
- ✅ 실시간 근무표 확인
- ✅ 간편 휴무 신청
- ✅ 근무 교대 요청
- ✅ 급여 명세서 조회
- ✅ 공지사항 확인
- ✅ 푸시 알림 수신

#### 👩‍💼 관리자용 기능
- ✅ 근무표 작성 및 수정
- ✅ 휴무 승인/반려
- ✅ 실시간 근태 현황
- ✅ 직원 관리
- ✅ 통계 및 리포트
- ✅ 긴급 공지 발송

### 모바일 최적화

#### 🚀 빠른 성능
- 3G/4G 환경 최적화
- 오프라인 모드 지원
- 빠른 로딩 속도

#### 🎨 직관적인 UI
- 터치 최적화 인터페이스
- 다크 모드 지원
- 접근성 기능 강화

#### 🔒 보안 강화
- 생체 인증 (지문/Face ID)
- 자동 로그아웃
- 암호화된 데이터 전송

### 특별 이벤트

🎁 **출시 기념 이벤트**
- 12월 31일까지 앱 다운로드 시
- 프리미엄 기능 1개월 무료
- 추첨을 통한 경품 증정

### 시스템 요구사항

**iOS**
- iOS 13.0 이상
- iPhone 6s 이상

**Android**
- Android 7.0 (API 24) 이상
- RAM 2GB 이상 권장

### 자주 묻는 질문

**Q: 웹 버전과 동기화되나요?**
A: 네, 실시간으로 완벽하게 동기화됩니다.

**Q: 태블릿도 지원하나요?**
A: iPad와 Android 태블릿 모두 지원합니다.

**Q: 데이터 사용량은 얼마나 되나요?**
A: 일반적인 사용 시 월 10MB 이하입니다.

### 향후 업데이트 계획

- ✨ Apple Watch 앱 출시 (1월)
- ✨ 음성 명령 기능 (2월)
- ✨ AR 근무표 뷰 (3월)

여러분의 피드백을 기다립니다. ggprgrkjh@naver.com로 의견을 보내주세요!

**케어브이와 함께 더 스마트한 근무 관리를 시작하세요!** 🎉
        `
    }
};

export default function BlogPostPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;
    const post = blogPosts[slug];

    if (!post) {
        return (
            <main className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
                <Navbar />
                <div className="container mx-auto max-w-4xl px-4 pt-32 text-center">
                    <h1 className="text-4xl font-bold mb-4">포스트를 찾을 수 없습니다</h1>
                    <p className="text-xl text-blue-100 mb-8">요청하신 블로그 포스트가 존재하지 않습니다.</p>
                    <Link href="/blog">
                        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            블로그로 돌아가기
                        </button>
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
            <Navbar />

            {/* 헤더 */}
            <section className="relative pt-32 pb-16 px-4">
                <div className="container mx-auto max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <Link href="/blog" className="inline-flex items-center text-blue-300 hover:text-blue-200 mb-6 transition-colors">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            블로그로 돌아가기
                        </Link>

                        <div className="flex items-center gap-3 mb-4 text-sm">
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                                {post.category}
                            </span>
                            <span className="text-gray-400">{post.date}</span>
                            <span className="text-gray-400">· {post.readTime}</span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
                            {post.title}
                        </h1>

                        <div className="flex flex-wrap gap-2">
                            {post.keywords.map((keyword, idx) => (
                                <span
                                    key={idx}
                                    className="text-sm px-3 py-1 bg-slate-700/50 text-blue-200 rounded"
                                >
                                    #{keyword}
                                </span>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 본문 */}
            <section className="pb-20 px-4">
                <div className="container mx-auto max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 md:p-12 border border-blue-400/20"
                    >
                        <div
                            className="prose prose-lg prose-invert max-w-none
                                prose-headings:text-white prose-headings:font-bold
                                prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
                                prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-blue-200
                                prose-h4:text-lg prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-blue-300
                                prose-p:text-gray-200 prose-p:leading-relaxed prose-p:mb-4
                                prose-strong:text-white prose-strong:font-semibold
                                prose-ul:text-gray-200 prose-ul:my-4
                                prose-li:my-1 prose-li:marker:text-blue-400
                                prose-code:text-blue-300 prose-code:bg-slate-800 prose-code:px-2 prose-code:py-1 prose-code:rounded
                                prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-600
                                prose-blockquote:border-blue-400 prose-blockquote:bg-slate-800/50 prose-blockquote:px-4 prose-blockquote:py-2
                                prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300"
                            dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(post.content) }}
                        />
                    </motion.div>

                    {/* 하단 CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mt-12 text-center"
                    >
                        <h3 className="text-2xl font-bold mb-4">더 많은 정보가 필요하신가요?</h3>
                        <p className="text-lg text-blue-100 mb-8">케어브이와 함께 스마트한 근무 관리를 시작하세요</p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/register">
                                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                    무료로 시작하기
                                </button>
                            </Link>
                            <Link href="/blog">
                                <button className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors">
                                    다른 글 보기
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}

function convertMarkdownToHtml(markdown: string): string {
    return markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^> (.+)/gim, '<blockquote>$1</blockquote>')
        .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- (.+)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/^✅ (.+)/gim, '<li>✅ $1</li>')
        .replace(/^\d+\. (.+)/gim, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(.+)$/gim, (match) => {
            if (!match.startsWith('<')) {
                return `<p>${match}</p>`;
            }
            return match;
        })
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<h[1-6]>)/g, '$1')
        .replace(/(<\/h[1-6]>)<\/p>/g, '$1');
}