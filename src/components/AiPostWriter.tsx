"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Banner } from "@astryxdesign/core/Banner";
import { Badge } from "@astryxdesign/core/Badge";
import { FileInput } from "@astryxdesign/core/FileInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconSparkles, IconCopy, IconRefresh } from "@tabler/icons-react";

type Channel = "band" | "blog";

interface AiPostResult {
  title: string;
  content: string;
  hashtags: string[];
}

interface AiPostWriterProps {
  companyName?: string | null;
  onNotification?: (message: string, type: "success" | "error" | "info") => void;
}

const MAX_IMAGES = 5;
// 업로드 전 클라이언트에서 축소하는 긴 변 기준 픽셀 (요청 크기·토큰 비용 절감)
const RESIZE_MAX_SIDE = 1024;

// 사진을 캔버스로 축소해 JPEG base64로 변환. 디코드 실패(HEIC 등) 시 원본 base64로 폴백.
async function fileToBase64Image(file: File): Promise<{ mimeType: string; data: string }> {
  const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, RESIZE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas 미지원");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { mimeType: "image/jpeg", data: dataUrl.split(",")[1] };
  } catch {
    const dataUrl = await readAsDataUrl(file);
    const [meta, data] = dataUrl.split(",");
    const mimeType = meta.match(/data:([^;]+)/)?.[1] || file.type || "image/jpeg";
    return { mimeType, data };
  }
}

export default function AiPostWriter({ companyName, onNotification }: AiPostWriterProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [channel, setChannel] = useState<Channel>("band");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AiPostResult | null>(null);

  // 썸네일 미리보기 URL — 파일 목록이 바뀔 때마다 다시 만들고 이전 것은 해제
  const previewUrls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => {
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewUrls]);

  const handleFilesChange = (value: File | File[] | null) => {
    const next = value == null ? [] : Array.isArray(value) ? value : [value];
    setFiles(next.slice(0, MAX_IMAGES));
    setErrorMessage(null);
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      setErrorMessage("사진을 1장 이상 올려주세요.");
      return;
    }
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const images = await Promise.all(files.map(fileToBase64Image));
      const token = localStorage.getItem("authToken");
      const today = new Date();
      const dateLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

      const response = await fetch("/api/v1/ai-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          channel,
          description,
          companyName: companyName || undefined,
          date: dateLabel,
          images,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "글 생성에 실패했습니다.");
      }
      setResult({
        title: data.title || "",
        content: data.content || "",
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      });
      onNotification?.("글이 완성됐어요. 내용을 확인하고 복사해서 올려주세요.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "글 생성에 실패했습니다.";
      setErrorMessage(message);
      onNotification?.(message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const buildFullText = (withTitle: boolean) => {
    if (!result) return "";
    const parts: string[] = [];
    if (withTitle && result.title) parts.push(result.title);
    if (result.content) parts.push(result.content);
    if (result.hashtags.length > 0) parts.push(result.hashtags.join(" "));
    return parts.join("\n\n");
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotification?.(`${label}를 복사했어요. 밴드/블로그에 붙여넣으세요.`, "success");
    } catch {
      onNotification?.("복사에 실패했습니다. 직접 드래그해서 복사해주세요.", "error");
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto" }}>
      <VStack gap={4}>
        <VStack gap={1}>
          <HStack gap={2} vAlign="center">
            <Icon icon={IconSparkles} size="md" color="accent" />
            <Heading level={2} type="display-3">AI 글쓰기 도우미</Heading>
          </HStack>
          <Text as="p" type="body" color="secondary">
            오늘 찍은 식사·프로그램 사진을 올리면 밴드/블로그 게시글을 자동으로 써드려요. 완성된 글을 복사해서 붙여넣기만 하면 됩니다.
          </Text>
        </VStack>

        <Card variant="default" padding={5}>
          <VStack gap={4}>
            <FileInput
              label="오늘의 사진"
              description={`식사, 프로그램, 만들기 활동 사진 등을 최대 ${MAX_IMAGES}장까지 올릴 수 있어요.`}
              value={files}
              onChange={handleFilesChange}
              accept="image/*"
              isMultiple
              maxFiles={MAX_IMAGES}
              mode="dropzone"
              placeholder="사진을 끌어다 놓거나 클릭해서 선택하세요"
              isDisabled={isGenerating}
            />

            {previewUrls.length > 0 && (
              <HStack gap={2} wrap="wrap">
                {previewUrls.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`올린 사진 ${index + 1}`}
                    style={{ width: 96, height: 96, objectFit: "cover", borderRadius: "var(--radius-inner)", border: "1px solid var(--color-border)" }}
                  />
                ))}
              </HStack>
            )}

            <SegmentedControl label="어디에 올릴 글인가요?" value={channel} onChange={(value) => setChannel(value as Channel)}>
              <SegmentedControlItem value="band" label="밴드 글" />
              <SegmentedControlItem value="blog" label="블로그 글" />
            </SegmentedControl>

            <TextArea
              label="상황 설명"
              isOptional
              value={description}
              onChange={setDescription}
              rows={3}
              maxLength={300}
              placeholder="예: 오늘 오전엔 원예 프로그램으로 다육이 화분을 만들었고, 점심은 잡채와 미역국이었어요."
              description="적어주시면 글이 훨씬 정확해져요. 비워두면 사진만 보고 작성합니다."
              isDisabled={isGenerating}
            />

            {errorMessage && (
              <Banner status="error" title={errorMessage} container="card" />
            )}

            <Button
              label={isGenerating ? "글을 쓰고 있어요..." : "버튼 하나로 글 완성하기"}
              variant="primary"
              size="lg"
              isLoading={isGenerating}
              isDisabled={files.length === 0}
              onClick={handleGenerate}
              icon={<Icon icon={IconSparkles} size="sm" color="inherit" />}
              style={{ width: "100%" }}
            />
          </VStack>
        </Card>

        {result && (
          <Card variant="teal" padding={5}>
            <VStack gap={4}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <Heading level={3} type="display-3">{result.title || "완성된 글"}</Heading>
                <Badge variant="teal" label={channel === "band" ? "밴드용" : "블로그용"} />
              </HStack>

              <div style={{ whiteSpace: "pre-wrap" }}>
                <Text as="p" type="body" color="primary">{result.content}</Text>
              </div>

              {result.hashtags.length > 0 && (
                <HStack gap={1.5} wrap="wrap">
                  {result.hashtags.map((tag) => (
                    <Badge key={tag} variant="neutral" label={tag} />
                  ))}
                </HStack>
              )}

              <HStack gap={2} wrap="wrap">
                <Button
                  label="전체 복사"
                  variant="primary"
                  size="md"
                  onClick={() => handleCopy(buildFullText(true), "제목·본문·해시태그")}
                  icon={<Icon icon={IconCopy} size="sm" color="inherit" />}
                />
                <Button
                  label="본문만 복사"
                  variant="secondary"
                  size="md"
                  onClick={() => handleCopy(buildFullText(false), "본문")}
                  icon={<Icon icon={IconCopy} size="sm" color="inherit" />}
                />
                <Button
                  label="다시 쓰기"
                  variant="ghost"
                  size="md"
                  isLoading={isGenerating}
                  onClick={handleGenerate}
                  icon={<Icon icon={IconRefresh} size="sm" color="inherit" />}
                />
              </HStack>

              <Text as="p" type="supporting" color="secondary">
                올리기 전에 내용을 한 번 확인해주세요. 어르신 개인정보가 드러나는 표현이 없는지 살펴보는 것이 좋아요.
              </Text>
            </VStack>
          </Card>
        )}
      </VStack>
    </div>
  );
}
