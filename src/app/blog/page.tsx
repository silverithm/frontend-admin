'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import Image from 'next/image';

interface BlogPost {
    id: number;
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    date: string;
    readTime: string;
    imageUrl?: string;
    keywords: string[];
}

export default function BlogPage() {
    const blogPosts: BlogPost[] = [
        {
            id: 1,
            slug: "carev-update-2024-12",
            title: "케어브이 12월 업데이트: 연차 관리 기능 대폭 강화",
            excerpt: "연차 자동 계산, 휴가 캘린더 뷰, 잔여 연차 실시간 확인 등 새롭게 추가된 연차 관리 기능을 소개합니다. 더욱 편리해진 휴무 관리를 경험해보세요.",
            category: "업데이트",
            date: "2024.12.15",
            readTime: "3분",
            keywords: ["연차관리", "업데이트", "휴가캘린더", "케어브이"]
        },
        {
            id: 2,
            slug: "shift-schedule-tips",
            title: "효율적인 근무표 작성을 위한 5가지 실전 팁",
            excerpt: "케어브이를 활용해 공평하고 효율적인 근무표를 작성하는 방법을 알아봅니다. 직원 만족도를 높이면서도 업무 효율을 극대화하는 노하우를 공유합니다.",
            category: "활용팁",
            date: "2024.12.10",
            readTime: "5분",
            keywords: ["근무표작성", "스케줄관리", "팁", "효율화"]
        },
        {
            id: 3,
            slug: "vacation-request-guide",
            title: "케어브이 휴무 신청 완벽 가이드",
            excerpt: "모바일에서 간편하게 휴무를 신청하고, 승인 상태를 실시간으로 확인하는 방법을 단계별로 안내합니다. 관리자와 직원 모두를 위한 필수 가이드입니다.",
            category: "가이드",
            date: "2024.12.05",
            readTime: "4분",
            keywords: ["휴무신청", "모바일", "가이드", "승인프로세스"]
        },
        {
            id: 4,
            slug: "team-communication-features",
            title: "팀 소통을 위한 케어브이 알림 기능 활용법",
            excerpt: "근무 변경, 휴무 승인, 공지사항 등 중요한 정보를 놓치지 않도록 도와주는 스마트 알림 기능을 최대한 활용하는 방법을 소개합니다.",
            category: "기능소개",
            date: "2024.11.30",
            readTime: "3분",
            keywords: ["알림기능", "팀소통", "공지사항", "실시간알림"]
        },
        {
            id: 5,
            slug: "monthly-schedule-export",
            title: "월간 근무표 엑셀 다운로드 및 인쇄 기능 안내",
            excerpt: "케어브이에서 작성한 근무표를 엑셀로 다운로드하고 깔끔하게 인쇄하는 방법을 알아봅니다. 보고서 작성이나 게시판 부착용으로 활용하세요.",
            category: "기능소개",
            date: "2024.11.25",
            readTime: "3분",
            keywords: ["엑셀다운로드", "인쇄", "월간근무표", "보고서"]
        },
        {
            id: 6,
            slug: "carev-mobile-app-launch",
            title: "케어브이 모바일 앱 정식 출시! iOS/Android 동시 지원",
            excerpt: "언제 어디서나 근무표를 확인하고 휴무를 신청할 수 있는 케어브이 모바일 앱이 출시되었습니다. 주요 기능과 다운로드 방법을 안내합니다.",
            category: "공지사항",
            date: "2024.11.20",
            readTime: "2분",
            keywords: ["모바일앱", "iOS", "Android", "출시"]
        }
    ];

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-indigo-900 text-white">
            <Navbar />

            {/* 헤더 섹션 */}
            <section className="relative pt-32 pb-16 px-4">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-indigo-100 bg-clip-text text-transparent">
                            케어브이 블로그
                        </h1>
                        <p className="text-xl text-blue-100/90 max-w-3xl mx-auto">
                            케어브이의 새로운 소식과 근무표 관리 노하우를 확인하세요
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* 블로그 포스트 그리드 */}
            <section className="py-16 px-4">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {blogPosts.map((post, index) => (
                            <motion.article
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Link href={`/blog/${post.slug}`}>
                                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 h-full flex flex-col cursor-pointer group">
                                        {/* 이미지 플레이스홀더 */}
                                        <div className="h-48 bg-gradient-to-br from-blue-600 to-indigo-600 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-black/20"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-4xl font-bold text-white/20">CareV</span>
                                            </div>
                                        </div>

                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex items-center gap-3 mb-3 text-sm">
                                                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                                                    {post.category}
                                                </span>
                                                <span className="text-gray-400">{post.date}</span>
                                                <span className="text-gray-400">· {post.readTime}</span>
                                            </div>

                                            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-blue-300 transition-colors">
                                                {post.title}
                                            </h3>

                                            <p className="text-gray-300 mb-4 line-clamp-3 flex-1">
                                                {post.excerpt}
                                            </p>

                                            <div className="flex flex-wrap gap-2">
                                                {post.keywords.slice(0, 3).map((keyword, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="text-xs px-2 py-1 bg-slate-700/50 text-blue-200 rounded"
                                                    >
                                                        #{keyword}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA 섹션 */}
            <section className="py-20 px-4">
                <div className="container mx-auto max-w-4xl text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-12"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            케어브이와 함께 스마트한 근무 관리를 시작하세요
                        </h2>
                        <p className="text-xl mb-8 text-blue-100">
                            지금 무료로 시작하고 팀의 업무 효율을 높여보세요
                        </p>
                        <Link href="/register">
                            <button className="px-8 py-4 bg-white text-blue-600 font-bold rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                                무료로 시작하기
                            </button>
                        </Link>
                    </motion.div>
                </div>
            </section>
        </main>
    );
}