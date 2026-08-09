'use client';

import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { Section } from '@astryxdesign/core/Section';
import { Card } from '@astryxdesign/core/Card';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Divider } from '@astryxdesign/core/Divider';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Link } from '@astryxdesign/core/Link';
import { Icon } from '@astryxdesign/core/Icon';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import Navbar from '@/components/Navbar';
import { getBlogPost } from '@/lib/blogPosts';
import { duration } from '@/theme/motion';

const contentWidth: React.CSSProperties = {
    width: '100%',
    maxWidth: 800,
    margin: '0 auto',
};

export default function BlogPostPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;
    const post = getBlogPost(slug);

    if (!post) {
        return (
            <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
                <Navbar />
                <Section variant="transparent" padding={0} paddingBlock={10}>
                    <div style={contentWidth}>
                        <EmptyState
                            title="글을 찾을 수 없습니다"
                            description="요청하신 블로그 글이 존재하지 않습니다."
                            actions={
                                <Button
                                    label="블로그로 돌아가기"
                                    variant="primary"
                                    onClick={() => router.push('/blog')}
                                />
                            }
                        />
                    </div>
                </Section>
            </main>
        );
    }

    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            {/* 글 머리 */}
            <Section variant="transparent" padding={0} paddingBlock={8}>
                <div style={contentWidth}>
                    {/* 글 제목(H1)이 LCP 후보 — opacity 애니메이션은 LCP를 늦추므로 transform만 사용 */}
                    <motion.div
                        initial={{ y: 16 }}
                        animate={{ y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={4}>
                            <Link href="/blog">
                                <HStack gap={1} vAlign="center">
                                    <Icon icon="chevronLeft" size="sm" color="inherit" />
                                    <Text color="inherit">블로그로 돌아가기</Text>
                                </HStack>
                            </Link>

                            <HStack gap={2} vAlign="center" wrap="wrap">
                                <Badge variant="teal" label={post.category} />
                                <Text type="supporting" color="secondary">
                                    <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                                </Text>
                                <Text type="supporting" color="secondary">{post.readTime}</Text>
                            </HStack>

                            <Heading level={1} type="display-1">
                                {post.title}
                            </Heading>

                            <Text type="large" color="secondary">
                                {post.excerpt}
                            </Text>

                            <Divider />
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* 본문 */}
            <Section variant="transparent" padding={0} paddingBlock={4}>
                <div style={contentWidth}>
                    <Card padding={8}>
                        <div
                            className="carev-blogpost-prose"
                            dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(post.content) }}
                        />
                    </Card>
                </div>
            </Section>

            {/* 하단 CTA */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={contentWidth}>
                    <Card padding={8} variant="teal">
                        <VStack gap={4} hAlign="center">
                            <VStack gap={2} hAlign="center">
                                <Heading level={2} type="display-2" justify="center">
                                    케어브이를 시작해보세요
                                </Heading>
                                <Text color="secondary" justify="center">
                                    결제 수단 등록 없이 30일 무료 체험으로 시작할 수 있습니다
                                </Text>
                            </VStack>
                            <HStack gap={3} hAlign="center" wrap="wrap">
                                <Button
                                    label="무료로 시작하기"
                                    variant="primary"
                                    size="lg"
                                    onClick={() => router.push('/signup')}
                                />
                                <Button
                                    label="다른 글 보기"
                                    variant="secondary"
                                    size="lg"
                                    onClick={() => router.push('/blog')}
                                />
                            </HStack>
                        </VStack>
                    </Card>
                </div>
            </Section>
        </main>
    );
}

/** "2026-07-31" → "2026년 7월 31일" — 게시일을 화면에 노출해 신선도 신호를 준다. */
function formatPostDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return `${year}년 ${month}월 ${day}일`;
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
        .replace(/^\d+\. (.+)/gim, '<li>$1</li>')
        .replace(/^---$/gim, '<hr />')
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
