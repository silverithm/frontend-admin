"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { FiPlus, FiTrash2, FiChevronUp, FiChevronDown, FiX, FiClipboard } from "react-icons/fi";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutPanel } from "@astryxdesign/core/Layout";
import { useDispatchStore, generateId } from "@/lib/dispatchStore";
import { getMemberUsers, getCompanyElders } from "@/lib/apiService";
import type { ElderlyInfo } from "@/types/elderly";
import { useConfirm } from "./ConfirmDialog";
import type { Route, RouteDriver, Senior, RouteType } from "@/types/dispatch";

// 직원 정보 타입
interface Member {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface DispatchSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification: (message: string, type: "success" | "error" | "info") => void;
}

export default function DispatchSettings({
  isOpen,
  onClose,
  onNotification,
}: DispatchSettingsProps) {
  const {
    settings,
    addRoute,
    updateRoute,
    deleteRoute,
    addSenior,
    updateSenior,
    deleteSenior,
  } = useDispatchStore();
  const { confirm, ConfirmContainer } = useConfirm();

  // 직원 목록 상태
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // 등록된 어르신 목록 (백엔드에서 가져옴)
  const [companySeniors, setCompanySeniors] = useState<ElderlyInfo[]>([]);
  const [selectedSeniorId, setSelectedSeniorId] = useState<string>("");

  // 직원 목록 가져오기
  const fetchMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const response = await getMemberUsers();
      // API 응답: { members: [...] }
      if (response?.members && Array.isArray(response.members)) {
        setMembers(response.members);
        console.log("직원 목록 로드:", response.members.length, "명");
      }
    } catch (err) {
      console.error("직원 목록 로드 실패:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // 어르신 목록 가져오기
  const fetchCompanySeniors = useCallback(async () => {
    try {
      const response = await getCompanyElders();
      if (response?.elders && Array.isArray(response.elders)) {
        setCompanySeniors(response.elders);
        console.log("어르신 목록 로드:", response.elders.length, "명");
      }
    } catch (err) {
      console.error("어르신 목록 로드 실패:", err);
    }
  }, []);

  // 모달이 열릴 때 직원 + 어르신 목록 fetch
  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      fetchCompanySeniors();
    }
  }, [isOpen, fetchMembers, fetchCompanySeniors]);

  // 선택된 노선
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // 새 노선 추가 모드
  const [isAddingRoute, setIsAddingRoute] = useState(false);

  // 새 노선 폼 상태
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteType, setNewRouteType] = useState<RouteType>("등원");
  const [newRouteDrivers, setNewRouteDrivers] = useState<RouteDriver[]>([
    { driverId: "", driverName: "", vehicleName: "", vehicleCapacity: 0 }
  ]);

  // 어르신 추가 상태 (드롭다운 방식으로 변경됨)

  // 선택된 노선
  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return null;
    return settings.routes.find(r => r.id === selectedRouteId) || null;
  }, [selectedRouteId, settings.routes]);

  // 선택된 노선의 어르신 목록
  const selectedRouteSeniors = useMemo(() => {
    if (!selectedRouteId) return [];
    return settings.seniors
      .filter(s => s.routeId === selectedRouteId)
      .sort((a, b) => a.boardingOrder - b.boardingOrder);
  }, [selectedRouteId, settings.seniors]);

  // 자동완성용: 기존에 사용된 운전자 이름들
  const knownDriverNames = useMemo(() => {
    const names = new Set<string>();
    settings.routes.forEach(route => {
      route.routeDrivers?.forEach(rd => {
        if (rd.driverName) names.add(rd.driverName);
      });
    });
    return Array.from(names);
  }, [settings.routes]);

  // 자동완성용: 기존에 사용된 차량명
  const knownVehicleNames = useMemo(() => {
    const names = new Set<string>();
    settings.routes.forEach(route => {
      route.routeDrivers?.forEach(rd => {
        if (rd.vehicleName) names.add(rd.vehicleName);
      });
    });
    return Array.from(names);
  }, [settings.routes]);

  // 새 노선 추가
  const handleAddRoute = () => {
    if (!newRouteName.trim()) {
      onNotification("노선 이름을 입력해주세요.", "error");
      return;
    }

    const validDrivers = newRouteDrivers.filter(d => d.driverName.trim());
    if (validDrivers.length === 0) {
      onNotification("최소 1명의 운전자를 입력해주세요.", "error");
      return;
    }

    const newRoute: Route = {
      id: generateId(),
      name: newRouteName.trim(),
      type: newRouteType,
      routeDrivers: validDrivers,
    };

    addRoute(newRoute);
    onNotification(`${newRoute.name} (${newRoute.type}) 노선이 추가되었습니다.`, "success");

    // 폼 초기화
    setNewRouteName("");
    setNewRouteType("등원");
    setNewRouteDrivers([{ driverId: "", driverName: "", vehicleName: "", vehicleCapacity: 0 }]);
    setIsAddingRoute(false);
    setSelectedRouteId(newRoute.id);
  };

  // 노선 삭제
  const handleDeleteRoute = async (routeId: string) => {
    const route = settings.routes.find(r => String(r.id) === String(routeId));
    if (!route) return;

    const confirmed = await confirm({
      title: '노선 삭제',
      message: `"${route.name} (${route.type})" 노선을 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;

    deleteRoute(String(route.id));
    if (selectedRouteId === routeId) {
      setSelectedRouteId(null);
    }
    onNotification("노선이 삭제되었습니다.", "success");
  };

  // 운전자 추가 (새 노선용)
  const addNewRouteDriver = () => {
    setNewRouteDrivers([...newRouteDrivers, { driverId: "", driverName: "", vehicleName: "", vehicleCapacity: 0 }]);
  };

  // 운전자 삭제 (새 노선용)
  const removeNewRouteDriver = (index: number) => {
    if (newRouteDrivers.length > 1) {
      setNewRouteDrivers(newRouteDrivers.filter((_, i) => i !== index));
    }
  };

  // 운전자 정보 업데이트 (새 노선용)
  const updateNewRouteDriver = (index: number, field: keyof RouteDriver, value: string | number) => {
    const updated = [...newRouteDrivers];
    updated[index] = { ...updated[index], [field]: value };
    setNewRouteDrivers(updated);
  };

  // 직원 선택 핸들러 (새 노선용) - driverId와 driverName 함께 설정
  const handleSelectMemberForNewRoute = (index: number, memberId: string) => {
    const member = members.find(m => String(m.id) === memberId);
    const updated = [...newRouteDrivers];
    updated[index] = {
      ...updated[index],
      driverId: memberId,
      driverName: member?.name || "",
    };
    setNewRouteDrivers(updated);
  };

  // 기존 노선의 운전자 업데이트
  const handleUpdateRouteDriver = (routeId: string, index: number, field: keyof RouteDriver, value: string | number) => {
    const route = settings.routes.find(r => r.id === routeId);
    if (!route) return;

    const updatedDrivers = [...(route.routeDrivers || [])];
    updatedDrivers[index] = { ...updatedDrivers[index], [field]: value };
    updateRoute(routeId, { routeDrivers: updatedDrivers });
  };

  // 직원 선택 핸들러 (기존 노선용) - driverId와 driverName 함께 설정
  const handleSelectMemberForRoute = (routeId: string, index: number, memberId: string) => {
    const route = settings.routes.find(r => r.id === routeId);
    if (!route) return;

    const member = members.find(m => String(m.id) === memberId);
    const updatedDrivers = [...(route.routeDrivers || [])];
    updatedDrivers[index] = {
      ...updatedDrivers[index],
      driverId: memberId,
      driverName: member?.name || "",
    };
    updateRoute(routeId, { routeDrivers: updatedDrivers });
  };

  // 기존 노선에 운전자 추가
  const handleAddRouteDriver = (routeId: string) => {
    const route = settings.routes.find(r => r.id === routeId);
    if (!route) return;

    const updatedDrivers = [...(route.routeDrivers || []), { driverId: "", driverName: "", vehicleName: "", vehicleCapacity: 0 }];
    updateRoute(routeId, { routeDrivers: updatedDrivers });
  };

  // 기존 노선에서 운전자 삭제
  const handleRemoveRouteDriver = (routeId: string, index: number) => {
    const route = settings.routes.find(r => r.id === routeId);
    if (!route || (route.routeDrivers?.length || 0) <= 1) return;

    const updatedDrivers = route.routeDrivers?.filter((_, i) => i !== index) || [];
    updateRoute(routeId, { routeDrivers: updatedDrivers });
  };

  // 어르신 추가 (드롭다운에서 선택)
  const handleAddSenior = () => {
    if (!selectedRouteId || !selectedSeniorId) {
      onNotification("어르신을 선택해주세요.", "error");
      return;
    }

    const selected = companySeniors.find(s => String(s.id) === selectedSeniorId);
    if (!selected) return;

    const maxOrder = Math.max(0, ...selectedRouteSeniors.map(s => s.boardingOrder));

    const newSenior: Senior = {
      id: generateId(),
      name: selected.name,
      routeId: selectedRouteId,
      boardingOrder: maxOrder + 1,
      elderlyId: selected.id,
    };

    addSenior(newSenior);
    setSelectedSeniorId("");
    onNotification(`${newSenior.name} 어르신이 추가되었습니다.`, "success");
  };

  // 현재 노선에 이미 배정된 어르신 ID 목록 (중복 방지)
  const assignedElderlyIds = useMemo(() => {
    if (!selectedRouteId) return new Set<number>();
    return new Set(
      settings.seniors
        .filter(s => s.routeId === selectedRouteId && s.elderlyId)
        .map(s => s.elderlyId as number)
    );
  }, [selectedRouteId, settings.seniors]);

  // 어르신 삭제
  const handleDeleteSenior = async (seniorId: string) => {
    const senior = settings.seniors.find(s => String(s.id) === String(seniorId));
    if (!senior) return;

    const confirmed = await confirm({
      title: '어르신 삭제',
      message: `"${senior.name}" 어르신을 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      type: 'danger',
    });
    if (!confirmed) return;

    deleteSenior(String(senior.id));
    onNotification("어르신이 삭제되었습니다.", "success");
  };

  // 어르신 순서 변경
  const handleMoveSenior = (seniorId: string, direction: "up" | "down") => {
    const index = selectedRouteSeniors.findIndex(s => s.id === seniorId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedRouteSeniors.length) return;

    // 순서 교환
    const senior1 = selectedRouteSeniors[index];
    const senior2 = selectedRouteSeniors[newIndex];

    updateSenior(senior1.id, { boardingOrder: senior2.boardingOrder });
    updateSenior(senior2.id, { boardingOrder: senior1.boardingOrder });
  };

  const memberOptions = members.map((member) => ({
    value: String(member.id),
    label: `${member.name}${member.email ? ` (${member.email})` : ""}`,
  }));

  const dividerStyle = "1px solid var(--color-border, #e5e7eb)";

  return (
    <>
      <ConfirmContainer />
      <Dialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        purpose="form"
        width={1000}
        maxHeight="90vh"
      >
        <Layout
          header={
            <DialogHeader
              title="배차 설정"
              onOpenChange={(open) => {
                if (!open) onClose();
              }}
            />
          }
          start={
            <LayoutPanel hasDivider width={320}>
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ padding: 'var(--spacing-4)', borderBottom: dividerStyle }}>
                  <Button
                    label="새 노선 추가"
                    variant="primary"
                    icon={<Icon icon={FiPlus} size="sm" />}
                    onClick={() => {
                      setIsAddingRoute(true);
                      setSelectedRouteId(null);
                    }}
                  />
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 'var(--spacing-2)' }}>
                  {settings.routes.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <Text type="body" color="secondary">
                        등록된 노선이 없습니다.
                      </Text>
                    </div>
                  ) : (
                    <VStack gap={1}>
                      {settings.routes.map((route) => {
                        const isSelected = selectedRouteId === route.id;
                        return (
                          <div
                            key={route.id}
                            onClick={() => {
                              setSelectedRouteId(route.id);
                              setIsAddingRoute(false);
                            }}
                            style={{
                              padding: 'var(--spacing-3)',
                              borderRadius: 'var(--radius-inner)',
                              cursor: "pointer",
                              transition: 'background-color var(--duration-fast) var(--ease-standard)',
                              background: isSelected
                                ? "var(--color-teal-background, #f0fdfa)"
                                : "var(--color-surface, #ffffff)",
                              border: isSelected
                                ? "2px solid var(--color-teal-border, #14b8a6)"
                                : dividerStyle,
                            }}
                          >
                            <HStack hAlign="between" vAlign="center">
                              <HStack gap={2} vAlign="center">
                                <Text type="body" weight="medium">
                                  {route.name}
                                </Text>
                                <Badge
                                  variant={route.type === "등원" ? "orange" : "purple"}
                                  label={route.type}
                                />
                              </HStack>
                              <IconButton
                                label="노선 삭제"
                                variant="ghost"
                                size="sm"
                                icon={<Icon icon={FiTrash2} size="sm" />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoute(route.id);
                                }}
                              />
                            </HStack>
                            <div style={{ marginTop: 'var(--spacing-1)' }}>
                              <Text type="supporting" color="secondary">
                                운전자 {route.routeDrivers?.length || 0}명 · 어르신{" "}
                                {settings.seniors.filter((s) => s.routeId === route.id).length}명
                              </Text>
                            </div>
                          </div>
                        );
                      })}
                    </VStack>
                  )}
                </div>
              </div>
            </LayoutPanel>
          }
          content={
            <LayoutContent>
              {isAddingRoute ? (
                /* 새 노선 추가 폼 */
                <VStack gap={6}>
                  <Text type="large" weight="bold">
                    새 노선 추가
                  </Text>

                  {/* 노선 이름 */}
                  <TextInput
                    label="노선 이름"
                    value={newRouteName}
                    onChange={(value) => setNewRouteName(value)}
                    placeholder="예: 스타리아, 카니발"
                  />

                  {/* 등원/하원 선택 */}
                  <VStack gap={2}>
                    <Text type="label">노선 유형</Text>
                    <SegmentedControl
                      label="노선 유형"
                      value={newRouteType}
                      onChange={(value) => setNewRouteType(value as RouteType)}
                    >
                      <SegmentedControlItem value="등원" label="등원" />
                      <SegmentedControlItem value="하원" label="하원" />
                    </SegmentedControl>
                  </VStack>

                  {/* 운전자 배정 */}
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="center">
                      <Text type="label">운전자 배정</Text>
                      {loadingMembers && (
                        <Text type="supporting" color="secondary">
                          (직원 목록 로딩중...)
                        </Text>
                      )}
                    </HStack>
                    <VStack gap={3}>
                      {newRouteDrivers.map((driver, index) => (
                        <div
                          key={index}
                          style={{
                            padding: 'var(--spacing-3)',
                            background: "var(--color-muted-background, #f9fafb)",
                            borderRadius: 'var(--radius-inner)',
                          }}
                        >
                          <HStack gap={2} vAlign="center">
                            <Badge
                              variant={index === 0 ? "teal" : "neutral"}
                              label={index === 0 ? "주" : `부${index}`}
                            />
                            <div style={{ flex: 1 }}>
                              <Selector
                                label="직원 선택"
                                isLabelHidden
                                placeholder="직원 선택"
                                options={memberOptions}
                                value={driver.driverId || ""}
                                hasClear
                                onChange={(value) =>
                                  handleSelectMemberForNewRoute(index, value ?? "")
                                }
                              />
                            </div>
                            <div style={{ width: 160 }}>
                              <TextInput
                                label="차량명"
                                isLabelHidden
                                value={driver.vehicleName}
                                onChange={(value) =>
                                  updateNewRouteDriver(index, "vehicleName", value)
                                }
                                placeholder="차량명"
                              />
                            </div>
                            {newRouteDrivers.length > 1 && (
                              <IconButton
                                label="운전자 삭제"
                                variant="ghost"
                                size="sm"
                                icon={<Icon icon={FiX} size="sm" />}
                                onClick={() => removeNewRouteDriver(index)}
                              />
                            )}
                          </HStack>
                        </div>
                      ))}
                      <Button
                        label="+ 부운전자 추가"
                        variant="secondary"
                        onClick={addNewRouteDriver}
                      />
                    </VStack>
                  </VStack>

                  {/* 저장 버튼 */}
                  <HStack gap={3}>
                    <Button
                      label="취소"
                      variant="secondary"
                      onClick={() => setIsAddingRoute(false)}
                    />
                    <Button label="노선 추가" variant="primary" onClick={handleAddRoute} />
                  </HStack>
                </VStack>
              ) : selectedRoute ? (
                /* 노선 상세 편집 */
                <VStack gap={6}>
                  <HStack gap={3} vAlign="center">
                    <Text type="large" weight="bold">
                      {selectedRoute.name}
                    </Text>
                    <Badge
                      variant={selectedRoute.type === "등원" ? "orange" : "purple"}
                      label={selectedRoute.type}
                    />
                  </HStack>

                  {/* 운전자 목록 */}
                  <VStack gap={2}>
                    <HStack gap={2} vAlign="center">
                      <Text type="label">운전자 배정</Text>
                      {loadingMembers && (
                        <Text type="supporting" color="secondary">
                          (직원 목록 로딩중...)
                        </Text>
                      )}
                    </HStack>
                    <VStack gap={3}>
                      {(selectedRoute.routeDrivers || []).map((driver, index) => {
                        const driverOptions =
                          driver.driverId &&
                          !members.find((m) => String(m.id) === driver.driverId)
                            ? [
                                ...memberOptions,
                                {
                                  value: driver.driverId,
                                  label: `${driver.driverName} (기존 데이터)`,
                                },
                              ]
                            : memberOptions;
                        return (
                          <div
                            key={index}
                            style={{
                              padding: 'var(--spacing-3)',
                              background: "var(--color-muted-background, #f9fafb)",
                              borderRadius: 'var(--radius-inner)',
                            }}
                          >
                            <HStack gap={2} vAlign="center">
                              <Badge
                                variant={index === 0 ? "teal" : "neutral"}
                                label={index === 0 ? "주" : `부${index}`}
                              />
                              <div style={{ flex: 1 }}>
                                <Selector
                                  label="직원 선택"
                                  isLabelHidden
                                  placeholder="직원 선택"
                                  options={driverOptions}
                                  value={driver.driverId || ""}
                                  hasClear
                                  onChange={(value) =>
                                    handleSelectMemberForRoute(
                                      selectedRoute.id,
                                      index,
                                      value ?? ""
                                    )
                                  }
                                />
                              </div>
                              <div style={{ width: 160 }}>
                                <TextInput
                                  label="차량명"
                                  isLabelHidden
                                  value={driver.vehicleName}
                                  onChange={(value) =>
                                    handleUpdateRouteDriver(
                                      selectedRoute.id,
                                      index,
                                      "vehicleName",
                                      value
                                    )
                                  }
                                  placeholder="차량명"
                                />
                              </div>
                              {(selectedRoute.routeDrivers?.length || 0) > 1 && (
                                <IconButton
                                  label="운전자 삭제"
                                  variant="ghost"
                                  size="sm"
                                  icon={<Icon icon={FiX} size="sm" />}
                                  onClick={() =>
                                    handleRemoveRouteDriver(selectedRoute.id, index)
                                  }
                                />
                              )}
                            </HStack>
                          </div>
                        );
                      })}
                      <Button
                        label="+ 부운전자 추가"
                        variant="secondary"
                        onClick={() => handleAddRouteDriver(selectedRoute.id)}
                      />
                    </VStack>
                  </VStack>

                  {/* 어르신 목록 */}
                  <VStack gap={2}>
                    <Text type="label">
                      탑승 어르신 ({selectedRouteSeniors.length}명)
                    </Text>

                    {/* 어르신 추가 (드롭다운) */}
                    <HStack gap={2} vAlign="end">
                      <div style={{ flex: 1 }}>
                        <Selector
                          label="어르신 선택"
                          isLabelHidden
                          placeholder="어르신 선택"
                          options={companySeniors
                            .filter((s) => !assignedElderlyIds.has(s.id))
                            .map((senior) => ({
                              value: String(senior.id),
                              label: `${senior.name}${
                                senior.requiredFrontSeat ? " (앞좌석)" : ""
                              }`,
                            }))}
                          value={selectedSeniorId}
                          onChange={(value) => setSelectedSeniorId(value ?? "")}
                        />
                      </div>
                      <Button
                        label="추가"
                        variant="primary"
                        isDisabled={!selectedSeniorId}
                        onClick={handleAddSenior}
                      />
                    </HStack>
                    {companySeniors.length === 0 && (
                      <Text type="supporting" color="secondary">
                        회원관리 &gt; 어르신 관리에서 먼저 어르신을 등록해주세요.
                      </Text>
                    )}

                    {/* 어르신 목록 */}
                    {selectedRouteSeniors.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "32px 0",
                          background: "var(--color-muted-background, #f9fafb)",
                          borderRadius: 'var(--radius-inner)',
                        }}
                      >
                        <Text type="body" color="secondary">
                          등록된 어르신이 없습니다.
                        </Text>
                      </div>
                    ) : (
                      <VStack gap={2}>
                        {selectedRouteSeniors.map((senior, index) => (
                          <div
                            key={senior.id}
                            style={{
                              padding: 'var(--spacing-3)',
                              background: "var(--color-muted-background, #f9fafb)",
                              borderRadius: 'var(--radius-inner)',
                            }}
                          >
                            <HStack hAlign="between" vAlign="center">
                              <HStack gap={3} vAlign="center">
                                <Badge variant="neutral" label={index + 1} />
                                <Text type="body" weight="medium">
                                  {senior.name}
                                </Text>
                              </HStack>
                              <HStack gap={1} vAlign="center">
                                <IconButton
                                  label="위로 이동"
                                  variant="ghost"
                                  size="sm"
                                  isDisabled={index === 0}
                                  icon={<Icon icon={FiChevronUp} size="sm" />}
                                  onClick={() => handleMoveSenior(senior.id, "up")}
                                />
                                <IconButton
                                  label="아래로 이동"
                                  variant="ghost"
                                  size="sm"
                                  isDisabled={index === selectedRouteSeniors.length - 1}
                                  icon={<Icon icon={FiChevronDown} size="sm" />}
                                  onClick={() => handleMoveSenior(senior.id, "down")}
                                />
                                <IconButton
                                  label="어르신 삭제"
                                  variant="ghost"
                                  size="sm"
                                  icon={<Icon icon={FiTrash2} size="sm" />}
                                  onClick={() => handleDeleteSenior(senior.id)}
                                />
                              </HStack>
                            </HStack>
                          </div>
                        ))}
                      </VStack>
                    )}
                  </VStack>
                </VStack>
              ) : (
                /* 선택 안내 */
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <VStack gap={4} vAlign="center">
                    <Icon icon={FiClipboard} size="lg" color="tertiary" />
                    <VStack gap={1} vAlign="center">
                      <Text type="body" color="secondary">
                        왼쪽에서 노선을 선택하거나
                      </Text>
                      <Text type="body" color="secondary">
                        새 노선을 추가해주세요.
                      </Text>
                    </VStack>
                  </VStack>
                </div>
              )}
            </LayoutContent>
          }
        />
      </Dialog>
    </>
  );
}
