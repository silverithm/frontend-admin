"use client";

// 노선배차표 - 하루치 배차 결과를 한 화면에 담는다.
//
// 센터장이 매일 카톡방에 손으로 적어 올리던 표를 그대로 옮긴 화면이다.
// 차량 13대 · 70여 명 규모가 스크롤 없이 들어와야 하므로 카드를 다단으로 흘리고
// 글자를 조밀하게 쓴다. "텍스트 복사"는 카톡에 그대로 붙여넣는 용도,
// "이미지 저장"은 사진으로 공유하는 용도다.

import { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { toPng, getFontEmbedCSS } from "html-to-image";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { VStack, HStack, StackItem } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";
import { DateInput } from "@astryxdesign/core/DateInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { IconCopy, IconPhotoDown } from "@tabler/icons-react";
import type { DispatchSettings, RouteType, RouteDispatch } from "@/types/dispatch";
import type { ElderDayAttendance } from "@/types/attendance";
import type { VacationRequest } from "@/types/vacation";
import { getDailyDispatch } from "@/lib/dispatchAlgorithm";
import {
  buildDispatchBoardText,
  buildRouteHeadline,
  countAttending,
  selectRouteDispatches,
} from "@/lib/dispatchBoardText";

/**
 * 캡처에 끼워 넣을 웹폰트 CSS.
 *
 * html-to-image는 캡처할 때마다 문서의 모든 스타일시트를 훑어 폰트를 인라인한다.
 * 이 화면은 그 작업이 무거워서 두 번째 저장부터 응답이 돌아오지 않았다.
 * 한 번 만들어 두고 재사용한다.
 */
let fontEmbedCSSCache: string | null = null;

/** 캡처가 끝나지 않을 때 버튼이 영원히 로딩으로 남지 않도록 끊는 시간 */
const CAPTURE_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("이미지 생성이 시간 안에 끝나지 않았습니다")), ms)
    ),
  ]);
}

async function resolveFontEmbedCSS(node: HTMLElement): Promise<string | undefined> {
  if (fontEmbedCSSCache !== null) return fontEmbedCSSCache;
  try {
    fontEmbedCSSCache = await getFontEmbedCSS(node);
    return fontEmbedCSSCache;
  } catch {
    // 폰트를 못 넣어도 캡처 자체는 되어야 한다 (시스템 폰트로 그려진다)
    fontEmbedCSSCache = "";
    return "";
  }
}

interface DispatchBoardProps {
  settings: DispatchSettings;
  vacations: VacationRequest[];
  attendances: ElderDayAttendance[];
  onNotification?: (message: string, type: "success" | "error" | "info") => void;
  /**
   * 배차 화면이 날짜를 들고 있을 때 넘긴다.
   * 배차표와 출결관리가 같은 날짜를 봐야 탭을 옮길 때마다 다시 고르지 않는다.
   */
  date?: string;
  /** 날짜가 바뀌면 그날 출결을 받아오라고 알린다 */
  onDateChange?: (date: string) => void;
}

export default function DispatchBoard({
  settings,
  vacations,
  attendances,
  onNotification,
  date: externalDate,
  onDateChange,
}: DispatchBoardProps) {
  const [internalDate, setInternalDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const date = externalDate ?? internalDate;
  const [routeType, setRouteType] = useState<RouteType>("등원");
  const [isCapturing, setIsCapturing] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const daily = useMemo(
    () => getDailyDispatch(date, settings, vacations, attendances),
    [date, settings, vacations, attendances]
  );

  const dispatches = useMemo(
    () => selectRouteDispatches(daily, routeType),
    [daily, routeType]
  );

  const personalSeniors =
    routeType === "등원" ? daily.personalPickupSeniors : daily.personalDropoffSeniors;
  const personalLabel = routeType === "등원" ? "개인등원" : "개인하원";
  // 헤더 숫자는 그날 센터에 오는 총원 (차량 탑승 + 개인등하원)
  const totalAttending = countAttending(daily, routeType);

  const handleDateChange = (value: string) => {
    if (externalDate === undefined) setInternalDate(value);
    onDateChange?.(value);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildDispatchBoardText(daily, routeType));
      onNotification?.("배차표를 복사했습니다. 카톡에 붙여넣으세요.", "success");
    } catch {
      onNotification?.("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.", "error");
    }
  };

  const handleSaveImage = async () => {
    const node = captureRef.current;
    const scroller = scrollRef.current;
    if (!node) return;

    setIsCapturing(true);

    // 화면에서는 남는 공간을 채우려고 늘어나 있다. 그대로 찍으면 표 아래로
    // 빈 여백이 길게 붙은 이미지가 나오므로, 찍는 동안만 내용 높이로 줄인다.
    const savedNodeHeight = node.style.height;
    const savedScrollerFlex = scroller?.style.flex ?? "";
    const savedScrollerOverflow = scroller?.style.overflowY ?? "";
    node.style.height = "auto";
    if (scroller) {
      scroller.style.flex = "none";
      scroller.style.overflowY = "visible";
    }

    try {
      const fontEmbedCSS = await resolveFontEmbedCSS(node);

      // 배경을 명시하지 않으면 투명 PNG가 나와 카톡에서 글자가 안 보인다.
      //
      // toPng은 만든 SVG를 <img>로 다시 읽어들이는데, 그 로드가 끝나지 않으면
      // 아무 일도 일어나지 않은 채 버튼만 계속 로딩으로 남는다. 그 상태로 두면
      // 사용자는 왜 안 되는지 알 수 없으므로 시간을 끊고 알려 준다.
      const dataUrl = await withTimeout(
        toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", fontEmbedCSS }),
        CAPTURE_TIMEOUT_MS
      );

      const link = document.createElement("a");
      link.download = `배차표_${date}_${routeType}.png`;
      link.href = dataUrl;
      link.click();
      onNotification?.("배차표 이미지를 저장했습니다.", "success");
    } catch (error) {
      console.error("[배차표] 이미지 저장 실패:", error);
      onNotification?.(
        "이미지 저장에 실패했습니다. 텍스트 복사를 이용해 주세요.",
        "error"
      );
    } finally {
      node.style.height = savedNodeHeight;
      if (scroller) {
        scroller.style.flex = savedScrollerFlex;
        scroller.style.overflowY = savedScrollerOverflow;
      }
      setIsCapturing(false);
    }
  };

  const dateLabel = format(parseISO(date), "M/d (EEE)", { locale: ko });

  return (
    <VStack gap={4} height="100%">
      {/* 조작 줄 */}
      <Card padding={4}>
        <HStack gap={3} vAlign="end" wrap="wrap" hAlign="between">
          <HStack gap={3} vAlign="end" wrap="wrap">
            <div style={{ minWidth: 160 }}>
              <DateInput
                label="날짜"
                value={date as ISODateString}
                onChange={(value) => handleDateChange(value ?? date)}
              />
            </div>
            <SegmentedControl
              label="등하원"
              value={routeType}
              onChange={(value) => setRouteType(value as RouteType)}
            >
              <SegmentedControlItem value="등원" label="등원" />
              <SegmentedControlItem value="하원" label="하원" />
            </SegmentedControl>
          </HStack>

          <HStack gap={2}>
            <Button
              label="텍스트 복사"
              variant="secondary"
              size="sm"
              icon={<IconCopy size={16} />}
              onClick={handleCopy}
            />
            <Button
              label="이미지 저장"
              variant="secondary"
              size="sm"
              icon={<IconPhotoDown size={16} />}
              isLoading={isCapturing}
              onClick={handleSaveImage}
            />
          </HStack>
        </HStack>
      </Card>

      {/* 캡처 대상 - 헤더 + 차량 카드들 */}
      <StackItem size="fill">
        <div
          ref={captureRef}
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-3)",
            background: "var(--color-background)",
            padding: "var(--spacing-3)",
            borderRadius: "var(--radius-container)",
          }}
        >
          {/* 헤더 */}
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Text type="large" weight="bold">
              {dateLabel} {routeType}
            </Text>
            <Badge variant="teal" label={`총 ${totalAttending}명`} />
            {personalSeniors.length > 0 && (
              <Text type="supporting">
                [{personalLabel} : {personalSeniors.map((s) => s.name).join(", ")}]
              </Text>
            )}
          </HStack>

          {dispatches.length === 0 ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EmptyState
                title={`${routeType} 노선이 없습니다`}
                description="배차 설정에서 노선을 추가하면 여기에 배차표가 만들어집니다."
              />
            </div>
          ) : (
            <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <Grid columns={{ minWidth: 240 }} gap={3}>
                {dispatches.map((rd) => (
                  <RouteBlock key={rd.routeId} dispatch={rd} />
                ))}
              </Grid>
            </div>
          )}
        </div>
      </StackItem>
    </VStack>
  );
}

/** 차량 한 대 - 헤드라인 + 회차별 명단 */
function RouteBlock({ dispatch: rd }: { dispatch: RouteDispatch }) {
  const isOff = rd.status === "운행없음" || rd.status === "휴일";

  return (
    <Card padding={3} variant={isOff ? "muted" : "default"}>
      <VStack gap={1.5}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text weight="semibold">{buildRouteHeadline(rd)}</Text>
          {rd.status === "대체" && <Badge variant="warning" label="대체" />}
          {!isOff && <Text type="supporting">{rd.passengers.length}명</Text>}
        </HStack>

        {isOff ? (
          <Text type="supporting" color="secondary">
            {rd.reason || rd.status}
          </Text>
        ) : rd.tripGroups.length === 0 ? (
          <Text type="supporting" color="disabled">
            탑승 없음
          </Text>
        ) : (
          rd.tripGroups.map((group, index) => (
            <HStack key={group.tripOrder ?? index} gap={1.5} vAlign="start">
              {group.tripOrder && (
                // "1차)"가 "1 / 차)"로 쪼개지면 명단이 아니라 오류처럼 읽힌다
                <div style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  <Text type="supporting" weight="semibold" color="accent">
                    {group.tripOrder}차)
                  </Text>
                </div>
              )}
              <Text type="supporting">{group.seniors.map((s) => s.name).join(" ")}</Text>
            </HStack>
          ))
        )}
      </VStack>
    </Card>
  );
}
