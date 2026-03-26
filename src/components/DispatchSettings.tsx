"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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

  if (!isOpen) return null;

  return (
    <>
    <ConfirmContainer />
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">배차 설정</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 노선 목록 */}
          <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => {
                  setIsAddingRoute(true);
                  setSelectedRouteId(null);
                }}
                className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                새 노선 추가
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {settings.routes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  등록된 노선이 없습니다.
                </div>
              ) : (
                <div className="space-y-1">
                  {settings.routes.map((route) => (
                    <div
                      key={route.id}
                      onClick={() => {
                        setSelectedRouteId(route.id);
                        setIsAddingRoute(false);
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedRouteId === route.id
                          ? "bg-teal-50 border-2 border-teal-500"
                          : "bg-white border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{route.name}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            route.type === "등원"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {route.type}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoute(route.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        운전자 {route.routeDrivers?.length || 0}명 · 어르신 {settings.seniors.filter(s => s.routeId === route.id).length}명
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 상세 편집 */}
          <div className="flex-1 overflow-y-auto p-6">
            {isAddingRoute ? (
              /* 새 노선 추가 폼 */
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-800">새 노선 추가</h3>

                {/* 노선 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">노선 이름</label>
                  <input
                    type="text"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    placeholder="예: 스타리아, 카니발"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-gray-900 placeholder-gray-400"
                  />
                </div>

                {/* 등원/하원 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">노선 유형</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setNewRouteType("등원")}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        newRouteType === "등원"
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      등원
                    </button>
                    <button
                      onClick={() => setNewRouteType("하원")}
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        newRouteType === "하원"
                          ? "bg-purple-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      하원
                    </button>
                  </div>
                </div>

                {/* 운전자 배정 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    운전자 배정
                    {loadingMembers && <span className="text-gray-400 ml-2 text-xs">(직원 목록 로딩중...)</span>}
                  </label>
                  <div className="space-y-3">
                    {newRouteDrivers.map((driver, index) => (
                      <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          index === 0 ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-600"
                        }`}>
                          {index === 0 ? "주" : `부${index}`}
                        </span>
                        <select
                          value={driver.driverId || ""}
                          onChange={(e) => handleSelectMemberForNewRoute(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                        >
                          <option value="">직원 선택</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name} {member.email ? `(${member.email})` : ""}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={driver.vehicleName}
                          onChange={(e) => updateNewRouteDriver(index, "vehicleName", e.target.value)}
                          placeholder="차량명"
                          list={`vehicle-names-new-${index}`}
                          className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400"
                        />
                        <datalist id={`vehicle-names-new-${index}`}>
                          {knownVehicleNames.map(name => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                        {newRouteDrivers.length > 1 && (
                          <button
                            onClick={() => removeNewRouteDriver(index)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addNewRouteDriver}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-colors"
                    >
                      + 부운전자 추가
                    </button>
                  </div>
                </div>

                {/* 저장 버튼 */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsAddingRoute(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddRoute}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                  >
                    노선 추가
                  </button>
                </div>
              </div>
            ) : selectedRoute ? (
              /* 노선 상세 편집 */
              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-bold text-gray-800">{selectedRoute.name}</h3>
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                    selectedRoute.type === "등원"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-purple-100 text-purple-700"
                  }`}>
                    {selectedRoute.type}
                  </span>
                </div>

                {/* 운전자 목록 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    운전자 배정
                    {loadingMembers && <span className="text-gray-400 ml-2 text-xs">(직원 목록 로딩중...)</span>}
                  </label>
                  <div className="space-y-3">
                    {(selectedRoute.routeDrivers || []).map((driver, index) => (
                      <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          index === 0 ? "bg-teal-100 text-teal-700" : "bg-gray-200 text-gray-600"
                        }`}>
                          {index === 0 ? "주" : `부${index}`}
                        </span>
                        <select
                          value={driver.driverId || ""}
                          onChange={(e) => handleSelectMemberForRoute(selectedRoute.id, index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                        >
                          <option value="">직원 선택</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name} {member.email ? `(${member.email})` : ""}
                            </option>
                          ))}
                          {/* 기존에 저장된 운전자가 목록에 없는 경우 표시 */}
                          {driver.driverId && !members.find(m => String(m.id) === driver.driverId) && (
                            <option value={driver.driverId}>
                              {driver.driverName} (기존 데이터)
                            </option>
                          )}
                        </select>
                        <input
                          type="text"
                          value={driver.vehicleName}
                          onChange={(e) => handleUpdateRouteDriver(selectedRoute.id, index, "vehicleName", e.target.value)}
                          placeholder="차량명"
                          list={`vehicle-names-${index}`}
                          className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400"
                        />
                        <datalist id={`vehicle-names-${index}`}>
                          {knownVehicleNames.map(name => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                        {(selectedRoute.routeDrivers?.length || 0) > 1 && (
                          <button
                            onClick={() => handleRemoveRouteDriver(selectedRoute.id, index)}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddRouteDriver(selectedRoute.id)}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-colors"
                    >
                      + 부운전자 추가
                    </button>
                  </div>
                </div>

                {/* 어르신 목록 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    탑승 어르신 ({selectedRouteSeniors.length}명)
                  </label>

                  {/* 어르신 추가 (드롭다운) */}
                  <div className="flex space-x-2 mb-3">
                    <select
                      value={selectedSeniorId}
                      onChange={(e) => setSelectedSeniorId(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-900 bg-white"
                    >
                      <option value="">어르신 선택</option>
                      {companySeniors
                        .filter(s => !assignedElderlyIds.has(s.id))
                        .map(senior => (
                          <option key={senior.id} value={String(senior.id)}>
                            {senior.name}{senior.requiredFrontSeat ? ' (앞좌석)' : ''}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddSenior}
                      disabled={!selectedSeniorId}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      추가
                    </button>
                  </div>
                  {companySeniors.length === 0 && (
                    <p className="text-xs text-gray-500 mb-2">
                      회원관리 &gt; 어르신 관리에서 먼저 어르신을 등록해주세요.
                    </p>
                  )}

                  {/* 어르신 목록 */}
                  {selectedRouteSeniors.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      등록된 어르신이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedRouteSeniors.map((senior, index) => (
                        <div
                          key={senior.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-300 text-gray-600 rounded-full text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-800">{senior.name}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleMoveSenior(senior.id, "up")}
                              disabled={index === 0}
                              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveSenior(senior.id, "down")}
                              disabled={index === selectedRouteSeniors.length - 1}
                              className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSenior(senior.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 선택 안내 */
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>왼쪽에서 노선을 선택하거나</p>
                  <p>새 노선을 추가해주세요.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
    </>
  );
}
