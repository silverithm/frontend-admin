'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Grid } from '@astryxdesign/core/Grid';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Badge } from '@astryxdesign/core/Badge';
import Navbar from '@/components/Navbar';
import { duration } from '@/theme/motion';

interface GuideStep {
    title: string;
    items: string[];
}

interface GuideSection {
    heading: string;
    description: string;
    steps: GuideStep[];
}

/**
 * 메뉴 이름은 관리자 페이지의 실제 탭 이름(근무조정, 월간일정, 공지사항, 채팅, 전자결재,
 * 회원관리)을 그대로 쓴다. 실재하지 않는 메뉴명을 안내하지 않는다.
 */
const ADMIN_GUIDE: GuideSection[] = [
    {
        heading: '관리자 시작하기',
        description: '기관 계정을 만들고 직원을 합류시키는 첫 단계입니다.',
        steps: [
            {
                title: '1. 회원가입',
                items: [
                    '웹에서 관리자 회원가입을 시작합니다',
                    '이메일과 비밀번호(8자 이상)를 입력합니다',
                    '이름, 기관명, 기관 주소를 입력합니다',
                    '개인정보 수집 및 이용에 동의하면 가입이 완료됩니다',
                ],
            },
            {
                title: '2. 직원 합류',
                items: [
                    '직원에게 앱 설치를 안내합니다',
                    '직원이 앱에서 소속 기관을 선택해 가입을 요청합니다',
                    '관리자 페이지에서 요청을 확인하고 승인합니다',
                    '승인된 직원은 바로 앱에 로그인할 수 있습니다',
                ],
            },
        ],
    },
    {
        heading: '휴무 요청 처리하기',
        description: '근무조정 메뉴에서 직원의 휴무 신청을 확인하고 처리합니다.',
        steps: [
            {
                title: '신청 확인과 처리',
                items: [
                    '근무조정 메뉴에서 대기 중인 신청을 확인합니다',
                    '신청한 날짜와 사유를 확인합니다',
                    '승인 또는 반려를 선택합니다',
                    '여러 건은 일괄 승인·반려로 한 번에 처리할 수 있습니다',
                ],
            },
            {
                title: '일정 확인',
                items: [
                    '월간일정에서 한 달치 일정을 달력으로 봅니다',
                    '날짜별 휴무 인원을 확인해 일정이 겹치지 않게 조율합니다',
                ],
            },
        ],
    },
    {
        heading: '전자결재 준비하기',
        description: '자주 쓰는 문서를 양식으로 등록해두면, 다음부터는 빈칸만 채워 올립니다.',
        steps: [
            {
                title: '1. 양식 등록 — 전자결재 > 양식 관리',
                items: [
                    '한글(HWP)·워드·PDF 파일을 올리거나, 화면에서 채우는 온라인 폼으로 만듭니다',
                    '기안 대분류(공문·교육·인사 등)를 지정하면 결재함에서 그 분류로 묶어 볼 수 있습니다',
                    '기본 결재선을 정해두면 이 양식으로 기안할 때 자동으로 채워집니다',
                    '파일이 10MB를 넘거나 지원하지 않는 형식이면 등록되지 않습니다 (hwp, hwpx, doc, docx, pdf, xls, xlsx, ppt, pptx, 이미지)',
                ],
            },
            {
                title: '2. 열람 대상 정하기 — 회의록처럼 여럿이 보는 문서',
                items: [
                    '양식 등록·편집 화면에서 직책을 체크하면 그 직책의 직원 전원이 이 양식으로 올린 문서를 봅니다',
                    '직책 옆의 인원수로 몇 명이 보게 되는지 확인할 수 있습니다',
                    '특정 직원만 따로 추가하려면 개인 지정으로 이름을 찍어 넣습니다',
                    '기관 관리자, 기안자 본인, 결재선에 포함된 사람은 지정하지 않아도 항상 볼 수 있습니다',
                    '직책으로 지정하려면 회원관리에서 직원에게 직책이 배정되어 있어야 합니다',
                ],
            },
            {
                title: '3. 서명과 직인 등록 — 기관 프로필',
                items: [
                    '기관 프로필에서 내 서명을 등록하면 결재란에 자동으로 찍힙니다',
                    '기관 직인을 등록하면 최종 승인된 문서의 발신명의에 날인됩니다',
                    '문서 하단 발신부(주소·연락처·팩스)도 기관 프로필의 정보를 따릅니다',
                ],
            },
        ],
    },
    {
        heading: '쓰던 시스템의 문서 옮겨오기',
        description: '다른 그룹웨어에서 결재가 끝난 문서를 보관용으로 가져옵니다. (기관 관리자만)',
        steps: [
            {
                title: '준비물 — 색인 엑셀과 문서 파일',
                items: [
                    '쓰던 시스템에서 결재 문서 목록을 엑셀로 내려받습니다',
                    '문서번호·제목·기안자·기안일·결재상태·결재자·결재일·첨부파일명이 열로 있으면 됩니다',
                    '열 이름은 시스템마다 달라도 케어브이가 알아서 맞춰봅니다 (못 알아본 열은 화면에 알려드립니다)',
                    '기안서 PDF와 첨부파일을 함께 준비합니다 — 엑셀의 파일명과 이름이 같아야 서로 붙습니다',
                ],
            },
            {
                title: '올리기 — 전자결재 > 결재 관리 > 과거 문서 이관',
                items: [
                    '색인 엑셀과 문서 파일을 고르고 "읽어보기"를 누르면 무엇이 들어갈지 먼저 보여줍니다',
                    '문제가 있는 줄은 이유와 함께 제외로 표시되고, 나머지만 등록됩니다',
                    '이관 문서의 열람 대상도 이때 직책으로 지정할 수 있습니다',
                    '결재가 끝난 문서만 가져올 수 있습니다 — 진행 중이던 문서는 대상이 아닙니다',
                ],
            },
            {
                title: '가져온 뒤',
                items: [
                    '결재함에 "이관" 표시와 원본 문서번호가 함께 보입니다',
                    '기안일이 그대로 들어가므로, 검색할 때 기간을 그 시기로 넓혀야 나옵니다',
                    '이미 끝난 결재라 승인·반려 버튼은 나오지 않습니다 — 검색과 열람용 기록입니다',
                    '같은 문서번호를 두 번 올리면 중복으로 걸러집니다',
                ],
            },
        ],
    },
    {
        heading: '결재 문서 처리하고 찾기',
        description: '올라온 문서를 처리하고, 지난 문서를 다시 찾아보는 방법입니다.',
        steps: [
            {
                title: '처리하기 — 전자결재 > 결재 관리',
                items: [
                    '진행중·승인됨·반려됨 탭으로 상태별로 나눠 봅니다',
                    '결재선이 있는 문서는 순서가 된 사람만 승인·반려할 수 있습니다',
                    '관리자는 남은 단계를 건너뛰고 처리하는 직권 승인(전결)을 쓸 수 있습니다',
                    '여러 건은 선택해서 일괄 승인·반려할 수 있습니다',
                ],
            },
            {
                title: '찾기 — 검색과 필터',
                items: [
                    '검색창은 제목·기안자뿐 아니라 양식명·문서번호·첨부파일명·본문 내용·결재자·열람 대상까지 함께 찾습니다',
                    '예: 회의록 본문에 적힌 안건이나 참석자 이름으로도 문서를 찾을 수 있습니다',
                    '기간, 기안 종류(대분류), 양식으로 좁혀서 볼 수 있습니다',
                    '기간을 넓게 잡지 않으면 오래된 문서는 검색에 걸리지 않습니다 — 기본값은 이번 달입니다',
                ],
            },
        ],
    },
    {
        heading: '그 밖의 메뉴',
        description: '휴무 관리 외에 기관 운영에 쓰는 메뉴입니다.',
        steps: [
            {
                title: '소통',
                items: [
                    '대시보드 — 오늘 처리할 일을 한 화면에 모아 봅니다',
                    '공지사항 — 구성원 전체에게 알릴 내용을 등록합니다. 공문 파일을 함께 올릴 수 있습니다',
                    '채팅 — 구성원 간 메시지를 주고받습니다',
                    '커뮤니티 — 다른 기관 종사자와 정보를 나눕니다',
                    '고충·건의함 — 직원이 익명으로 올린 의견을 관리자가 확인합니다',
                ],
            },
            {
                title: '기록과 운영',
                items: [
                    '월간일정 — 어르신 생신·프로그램·회의 일정을 달력으로 관리하고 담당자를 지정합니다',
                    '자료실 — 기관에서 함께 쓰는 문서를 모아둡니다',
                    '회원관리 — 구성원 정보, 가입 요청, 직책과 권한, 어르신 명단을 관리합니다',
                    '편의기능 — 배차관리와 AI 글쓰기를 씁니다',
                ],
            },
        ],
    },
];

const EMPLOYEE_GUIDE: GuideSection[] = [
    {
        heading: '직원 시작하기',
        description: '앱을 설치하고 소속 기관에 합류합니다.',
        steps: [
            {
                title: '1. 가입 요청',
                items: [
                    'App Store 또는 Google Play에서 케어브이 앱을 설치합니다',
                    '앱에서 소속 기관을 선택합니다',
                    '가입 요청을 제출합니다',
                    '관리자가 승인할 때까지 기다립니다',
                ],
            },
            {
                title: '2. 로그인',
                items: [
                    '관리자 승인이 완료되면 앱에 로그인합니다',
                    '알림을 허용하면 처리 결과를 놓치지 않습니다',
                ],
            },
        ],
    },
    {
        heading: '휴무 신청하기',
        description: '앱 또는 웹에서 휴무를 신청하고 결과를 확인합니다.',
        steps: [
            {
                title: '신청 절차',
                items: [
                    '휴무 신청 메뉴를 엽니다',
                    '휴무 유형을 고릅니다 — 연차, 오전 반차, 오후 반차, 필수 휴무',
                    '날짜를 선택합니다',
                    '사유를 입력하고 제출합니다',
                ],
            },
            {
                title: '결과 확인',
                items: [
                    '제출한 신청은 관리자가 처리하기 전까지 대기 상태입니다',
                    '승인되면 일정에 반영됩니다',
                    '반려된 경우 사유를 확인하고 다시 신청할 수 있습니다',
                ],
            },
        ],
    },
    {
        heading: '일정 확인하기',
        description: '내 근무와 동료 일정을 확인합니다.',
        steps: [
            {
                title: '캘린더 보기',
                items: [
                    '달력에서 내 휴무 일정을 확인합니다',
                    '같은 기관 구성원의 휴무 일정도 함께 볼 수 있습니다',
                    '공지사항에서 기관의 알림을 확인합니다',
                ],
            },
        ],
    },
    {
        heading: '결재 문서 올리고 보기',
        description: '휴가원·지출품의 같은 문서를 올리고, 공유된 문서를 열람합니다.',
        steps: [
            {
                title: '기안하기 — 결재 신청',
                items: [
                    '양식을 고르면 결재선과 열람 대상이 양식에 정해진 대로 자동으로 채워집니다',
                    '한글 양식은 내려받지 않고 화면에서 바로 작성할 수 있습니다',
                    '작성하다 멈춰야 하면 임시저장해두고 나중에 이어서 쓸 수 있습니다',
                    '내 서명을 미리 등록해두면 결재란에 자동으로 찍힙니다',
                ],
            },
            {
                title: '문서함 — 공유된 문서 보기',
                items: [
                    '회의록처럼 내 직책이 열람 대상으로 지정된 문서는 문서함에서 볼 수 있습니다',
                    '내가 올린 문서, 내가 결재선에 포함된 문서도 함께 보입니다',
                    '제목·기안자·양식·본문 내용·첨부파일명으로 찾을 수 있습니다',
                    '기간을 넓혀야 오래된 문서가 검색에 걸립니다 — 기본값은 이번 달입니다',
                ],
            },
        ],
    },
];

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState('admin');
    const sections = activeTab === 'admin' ? ADMIN_GUIDE : EMPLOYEE_GUIDE;

    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            {/* 헤더 */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={5} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={1} type="display-1" justify="center">
                                    케어브이 사용 가이드
                                </Heading>
                                <Text type="large" color="secondary" justify="center">
                                    장기요양기관 관리자와 직원을 위한 사용 방법
                                </Text>
                            </VStack>

                            <SegmentedControl
                                value={activeTab}
                                onChange={(value) => setActiveTab(value)}
                                label="가이드 종류"
                            >
                                <SegmentedControlItem value="admin" label="관리자 가이드" />
                                <SegmentedControlItem value="employee" label="직원 가이드" />
                            </SegmentedControl>
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* 본문 */}
            <Section variant="transparent" padding={0} paddingBlock={4}>
                <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <VStack gap={10}>
                        {sections.map((section, sectionIndex) => (
                            <motion.div
                                key={`${activeTab}-${section.heading}`}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ duration: duration.medium, delay: sectionIndex * 0.05 }}
                            >
                                <VStack gap={5}>
                                    <VStack gap={2}>
                                        <HStack gap={2} vAlign="center" wrap="wrap">
                                            <Heading level={2} type="display-2">
                                                {section.heading}
                                            </Heading>
                                            <Badge
                                                variant="teal"
                                                label={activeTab === 'admin' ? '관리자' : '직원'}
                                            />
                                        </HStack>
                                        <Text color="secondary">{section.description}</Text>
                                    </VStack>

                                    <Grid columns={{ minWidth: 320, repeat: 'fit' }} gap={5}>
                                        {section.steps.map((step) => (
                                            <Card key={step.title} padding={6} height="100%">
                                                <VStack gap={4}>
                                                    <Heading level={3} type="display-3">
                                                        {step.title}
                                                    </Heading>
                                                    <VStack gap={3}>
                                                        {step.items.map((item) => (
                                                            <HStack key={item} gap={2} vAlign="start">
                                                                <span style={{ paddingTop: 'var(--spacing-0-5)' }}>
                                                                    <Icon icon="check" size="sm" color="accent" />
                                                                </span>
                                                                <Text color="secondary">{item}</Text>
                                                            </HStack>
                                                        ))}
                                                    </VStack>
                                                </VStack>
                                            </Card>
                                        ))}
                                    </Grid>
                                </VStack>
                            </motion.div>
                        ))}
                    </VStack>
                </div>
            </Section>

            {/* CTA */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <Card padding={8} variant="teal">
                        <VStack gap={4} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={2} type="display-2" justify="center">
                                    아직 궁금한 점이 있으신가요?
                                </Heading>
                                <Text color="secondary" justify="center">
                                    자주 묻는 질문을 확인하거나 이메일로 문의해주세요
                                </Text>
                            </VStack>
                            <HStack gap={3} hAlign="center" wrap="wrap">
                                <Button label="자주 묻는 질문" href="/faq" variant="primary" size="lg" />
                                <Button
                                    label="문의하기"
                                    href="/contact"
                                    variant="secondary"
                                    size="lg"
                                />
                            </HStack>
                        </VStack>
                    </Card>
                </div>
            </Section>
        </main>
    );
}
