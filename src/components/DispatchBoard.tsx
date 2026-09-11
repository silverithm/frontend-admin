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
import { IconCopy, IconPhotoDown, IconPencil, IconArrowBackUp } from "@tabler/icons-react";
import type {
  DispatchAssignmentOverride,
  DispatchSettings,
  RouteType,
  RouteDispatch,
  Senior,
  TripOrder,
} from "@/types/dispatch";
import type { ElderDayAttendance } from "@/types/attendance";
import type { VacationRequest } from "@/types/vacation";
import { applyDispatchOverrides, getDailyDispatch } from "@/lib/dispatchAlgorithm";
import { nextBoardingOrder } from "@/lib/dispatchBoardEdit";
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
  /**
   * 그날 하루치 수정본. 여기 있는 어르신은 설정이 아니라 이 배치로 탄다.
   * 배차표를 손으로 고칠 수 있게 하되, 설정(내일 이후)은 건드리지 않기 위한 장치다.
   */
  overrides?: DispatchAssignmentOverride[];
  /** 수정본이 바뀌었을 때 — 저장은 부모가 한다 (빈 배열이면 '원래대로') */
  onOverridesChange?: (next: DispatchAssignmentOverride[]) => void;
}

export default function DispatchBoard({
  settings,
  vacations,
  attendances,
  onNotification,
  date: externalDate,
  onDateChange,
  overrides,
  onOverridesChange,
}: DispatchBoardProps) {
  const [internalDate, setInternalDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const date = externalDate ?? internalDate;
  const [routeType, setRouteType] = useState<RouteType>("등원");
  const [isCapturing, setIsCapturing] = useState(false);
  // 평소에는 드래그가 안 되게 잠가 둔다 — 명단을 보다가 손이 미끄러져 바뀌면 알아채기 어렵다
  const [isEditing, setIsEditing] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 그날 수정본을 얹은 명단으로 배차를 계산한다. 설정 자체는 그대로 둔다.
  const effectiveSettings = useMemo(
    () => ({ ...settings, seniors: applyDispatchOverrides(settings.seniors, overrides) }),
    [settings, overrides]
  );

  const daily = useMemo(
    () => getDailyDispatch(date, effectiveSettings, vacations, attendances),
    [date, effectiveSettings, vacations, attendances]
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

  /**
   * 어르신 한 분을 다른 차(또는 회차)로 옮긴다.
   *
   * 탑승 순서는 **떨어뜨린 자리**로 정한다 — 앞사람과 뒷사람 사이의 값을 준다.
   * 정수로 다시 매기면 그 차에 탄 나머지 분들의 순서까지 전부 수정본에 넣어야 하고,
   * 그러면 나중에 설정에서 순서를 바꿔도 그날만 옛 순서로 남는다. 옮긴 사람만 기록한다.
   */
  const moveSenior = (
    seniorId: string,
    targetRouteId: string,
    targetTripOrder: TripOrder | undefined,
    beforeSeniorId: string | null
  ) => {
    if (!onOverridesChange) return;

    const targetRoute = daily.routeDispatches.find((rd) => rd.routeId === targetRouteId);
    const group = targetRoute?.tripGroups.find((g) => g.tripOrder === targetTripOrder);
    const list: Senior[] = (group?.seniors ?? []).filter((s) => s.id !== seniorId);

    const index = beforeSeniorId ? list.findIndex((s) => s.id === beforeSeniorId) : -1;
    const boardingOrder = nextBoardingOrder(list, index);

    const kept = (overrides ?? []).filter((o) => String(o.seniorId) !== String(seniorId));
    onOverridesChange([
      ...kept,
      { seniorId, routeId: targetRouteId, tripOrder: targetTripOrder, boardingOrder },
    ]);
  };

  const handleResetOverrides = () => {
    onOverridesChange?.([]);
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

    // 화면에서는 표가 스크롤 상자 안에 갇혀 남는 공간에 맞춰 늘어나 있다.
    // 그대로 찍으면 (1) 스크롤로 가려진 차량이 잘리고 (2) 표 아래로 빈 여백이
    // 길게 붙는다. 찍는 동안만 상자를 풀어 내용 전체가 제 높이로 펼쳐지게 한다.
    const savedNodeHeight = node.style.height;
    const savedScrollerFlex = scroller?.style.flex ?? "";
    const savedScrollerOverflow = scroller?.style.overflowY ?? "";
    node.style.height = "auto";
    if (scroller) {
      scroller.style.flex = "none";
      scroller.style.overflowY = "visible";
    }

    // 바뀐 레이아웃을 즉시 반영시키고 페인트 여유를 준다.
    // (requestAnimationFrame은 탭이 가려지면 멈추므로 타이머를 쓴다 —
    //  같은 이유로 캡처가 멈추는 것을 이미 겪었다)
    void node.offsetHeight;
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    try {
      const fontEmbedCSS = await resolveFontEmbedCSS(node);

      // 배경을 명시하지 않으면 투명 PNG가 나와 카톡에서 글자가 안 보인다.
      //
      // 크기를 scrollWidth/Height로 못박아야 화면 밖으로 넘어간 부분까지 담긴다.
      // 배율은 pixelRatio가 맡는다 — 크기에 직접 2를 곱하면 이중 적용돼 잘린다.
      //
      // toPng은 만든 SVG를 <img>로 다시 읽어들이는데, 그 로드가 끝나지 않으면
      // 아무 일도 일어나지 않은 채 버튼만 계속 로딩으로 남는다. 그 상태로 두면
      // 사용자는 왜 안 되는지 알 수 없으므로 시간을 끊고 알려 준다.
      const dataUrl = await withTimeout(
        toPng(node, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width: node.scrollWidth,
          height: node.scrollHeight,
          fontEmbedCSS,
        }),
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
            {onOverridesChange && (
              <>
                {/* 오늘 고친 것이 있으면 언제든 설정대로 되돌릴 수 있어야 한다 */}
                {(overrides?.length ?? 0) > 0 && (
                  <Button
                    label="원래대로"
                    variant="ghost"
                    size="sm"
                    icon={<IconArrowBackUp size={16} />}
                    onClick={handleResetOverrides}
                  />
                )}
                <Button
                  label={isEditing ? "수정 끝" : "수정"}
                  variant={isEditing ? "primary" : "secondary"}
                  size="sm"
                  icon={<IconPencil size={16} />}
                  onClick={() => setIsEditing((on) => !on)}
                />
              </>
            )}
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

          {isEditing && (
            <Text type="supporting" color="secondary">
              어르신 이름을 끌어 다른 차·회차에 놓으면 오늘 배차만 바뀝니다. 노선 설정과 내일 이후는 그대로입니다.
            </Text>
          )}

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
                  <RouteBlock
                    key={rd.routeId}
                    dispatch={rd}
                    isEditing={isEditing}
                    onMove={moveSenior}
                  />
                ))}
              </Grid>
            </div>
          )}
        </div>
      </StackItem>
    </VStack>
  );
}

/** 드래그로 옮기는 중인 어르신 (카드 사이를 건너가므로 모듈 수준에 둔다) */
interface DragPayload {
  seniorId: string;
  name: string;
}

/** 차량 한 대 - 헤드라인 + 회차별 명단 */
function RouteBlock({
  dispatch: rd,
  isEditing,
  onMove,
}: {
  dispatch: RouteDispatch;
  isEditing: boolean;
  onMove: (
    seniorId: string,
    routeId: string,
    tripOrder: TripOrder | undefined,
    beforeSeniorId: string | null
  ) => void;
}) {
  const isOff = rd.status === "운행없음" || rd.status === "휴일";
  // 어느 자리에 놓이는지 보이지 않으면 '어디로 갈지 모르고 놓는' 조작이 된다
  const [dropHint, setDropHint] = useState<string | null>(null);

  const readDrag = (event: React.DragEvent): DragPayload | null => {
    try {
      const raw = event.dataTransfer.getData("application/x-carev-senior");
      return raw ? (JSON.parse(raw) as DragPayload) : null;
    } catch {
      return null;
    }
  };

  const handleDrop = (
    event: React.DragEvent,
    tripOrder: TripOrder | undefined,
    beforeSeniorId: string | null
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDropHint(null);
    const payload = readDrag(event);
    if (!payload) return;
    // 운행하지 않는 차에 태우면 그 어르신이 명단에서 사라져 버린다
    if (isOff) return;
    onMove(payload.seniorId, rd.routeId, tripOrder, beforeSeniorId);
  };

  const allowDrop = (event: React.DragEvent, hint: string) => {
    if (!isEditing || isOff) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropHint(hint);
  };

  // 회차를 쓰지 않는 노선에 처음 놓을 때의 회차값 — 기존 그룹을 따라간다
  const defaultTripOrder = rd.tripGroups[0]?.tripOrder;

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
          // 빈 차에도 놓을 수 있어야 한다 — 오늘만 저 차에 태우는 일이 실제로 생긴다
          <div
            onDragOver={(event) => allowDrop(event, "empty")}
            onDragLeave={() => setDropHint(null)}
            onDrop={(event) => handleDrop(event, defaultTripOrder, null)}
            style={{
              padding: "var(--spacing-1)",
              borderRadius: "var(--radius-inner)",
              border: isEditing ? "1px dashed var(--color-border)" : "none",
              background: dropHint === "empty" ? "var(--color-background-muted)" : "transparent",
            }}
          >
            <Text type="supporting" color="disabled">
              {isEditing ? "여기에 놓으면 이 차에 태웁니다" : "탑승 없음"}
            </Text>
          </div>
        ) : (
          rd.tripGroups.map((group, index) => {
            const groupKey = String(group.tripOrder ?? index);
            return (
              <HStack key={groupKey} gap={1.5} vAlign="start">
                {group.tripOrder && (
                  // "1차)"가 "1 / 차)"로 쪼개지면 명단이 아니라 오류처럼 읽힌다
                  <div style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                    <Text type="supporting" weight="semibold" color="accent">
                      {group.tripOrder}차)
                    </Text>
                  </div>
                )}
                {isEditing ? (
                  <div
                    onDragOver={(event) => allowDrop(event, `g${groupKey}`)}
                    onDragLeave={() => setDropHint(null)}
                    onDrop={(event) => handleDrop(event, group.tripOrder, null)}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--spacing-1)",
                      flex: 1,
                      minWidth: 0,
                      padding: "var(--spacing-1)",
                      borderRadius: "var(--radius-inner)",
                      background:
                        dropHint === `g${groupKey}` ? "var(--color-background-muted)" : "transparent",
                    }}
                  >
                    {group.seniors.map((senior) => (
                      <span
                        key={senior.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/x-carev-senior",
                            JSON.stringify({ seniorId: senior.id, name: senior.name } as DragPayload)
                          );
                        }}
                        onDragOver={(event) => allowDrop(event, `s${senior.id}`)}
                        onDragLeave={() => setDropHint(null)}
                        onDrop={(event) => handleDrop(event, group.tripOrder, senior.id)}
                        className="carev-dispatch-chip"
                        style={{
                          borderLeft:
                            dropHint === `s${senior.id}`
                              ? "2px solid var(--color-accent)"
                              : "2px solid transparent",
                        }}
                      >
                        {senior.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Text type="supporting">{group.seniors.map((s) => s.name).join(" ")}</Text>
                )}
              </HStack>
            );
          })
        )}
      </VStack>
    </Card>
  );
}
