'use client';

import { motion } from 'framer-motion';
import { Section } from '@astryxdesign/core/Section';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Grid } from '@astryxdesign/core/Grid';
import { VStack, HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Heading';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { FiBookOpen } from 'react-icons/fi';
import Navbar from '@/components/Navbar';
import { BLOG_POSTS } from '@/lib/blogPosts';
import { duration } from '@/theme/motion';

/** 액센트 아이콘 칩 — 랜딩과 동일한 브랜드 틸 틴트. */
const iconChipStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 'var(--radius-container)',
    background: 'var(--color-accent-muted)',
    color: 'var(--color-icon-accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
};

export default function BlogPage() {
    return (
        <main style={{ minHeight: '100vh', background: 'var(--color-background-surface)' }}>
            <Navbar />

            {/* 헤더 */}
            <Section variant="transparent" padding={0} paddingBlock={10}>
                <div style={{ width: '100%', maxWidth: 1152, margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: duration.mediumMax }}
                    >
                        <VStack gap={2} hAlign="center">
                            <Heading level={1} type="display-1" justify="center">
                                케어브이 블로그
                            </Heading>
                            <Text type="large" color="secondary" justify="center">
                                케어브이 사용법과 기능 안내를 확인하세요
                            </Text>
                        </VStack>
                    </motion.div>
                </div>
            </Section>

            {/* 글 목록 */}
            <Section variant="transparent" padding={0} paddingBlock={6}>
                <div style={{ width: '100%', maxWidth: 1152, margin: '0 auto' }}>
                    <Grid columns={{ minWidth: 320, repeat: 'fit' }} gap={5}>
                        {BLOG_POSTS.map((post, index) => (
                            <motion.article
                                key={post.slug}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-80px' }}
                                transition={{ duration: duration.medium, delay: index * 0.05 }}
                                style={{ height: '100%' }}
                            >
                                <ClickableCard
                                    label={post.title}
                                    href={`/blog/${post.slug}`}
                                    padding={6}
                                    height="100%"
                                >
                                    <VStack gap={3}>
                                        <HStack gap={3} vAlign="center">
                                            <span style={iconChipStyle}>
                                                <Icon icon={FiBookOpen} size="sm" color="inherit" />
                                            </span>
                                            <HStack gap={2} vAlign="center" wrap="wrap">
                                                <Badge variant="teal" label={post.category} />
                                                <Text type="supporting" color="secondary">
                                                    {post.readTime}
                                                </Text>
                                            </HStack>
                                        </HStack>

                                        <Heading level={2} type="display-3" maxLines={2}>
                                            {post.title}
                                        </Heading>

                                        <Text color="secondary" maxLines={3}>
                                            {post.excerpt}
                                        </Text>

                                        <HStack gap={1} wrap="wrap">
                                            {post.keywords.slice(0, 3).map((keyword) => (
                                                <Text key={keyword} type="supporting" color="disabled">
                                                    #{keyword}
                                                </Text>
                                            ))}
                                        </HStack>
                                    </VStack>
                                </ClickableCard>
                            </motion.article>
                        ))}
                    </Grid>
                </div>
            </Section>
        </main>
    );
}
