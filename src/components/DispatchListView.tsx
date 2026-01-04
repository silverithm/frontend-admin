"use client";

import { useState, useMemo } from "react";
import { format, parseISO, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import type { DispatchSettings, SeniorAbsence, DailyDispatch } from "@/types/dispatch";
import type { VacationRequest } from "@/types/vacation";
import { getDispatchForDateRange } from "@/lib/dispatchAlgorithm";

interface DispatchListViewProps {
  settings: DispatchSettings;
  vacations: VacationRequest[];
  seniorAbsences: SeniorAbsence[];
}

export default function DispatchListView({
  settings,
  vacations,
  seniorAbsences,
}: DispatchListViewProps) {
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 배차 데이터 계산
  const dispatches = useMemo(() => {
    if (!startDate || !endDate) return [];
    return getDispatchForDateRange(startDate, endDate, settings, vacations, seniorAbsences);
  }, [startDate, endDate, settings, vacations, seniorAbsences]);

  // 필터링된 데이터
  const filteredDispatches = useMemo(() => {
    return dispatches.map((daily) => ({
      ...daily,
      routeDispatches: daily.routeDispatches.filter((rd) => {
        if (routeFilter !== "all" && rd.routeId !== routeFilter) return false;
        if (statusFilter !== "all" && rd.status !== statusFilter) return false;
        return true;
      }),
    })).filter((daily) => daily.routeDispatches.length > 0);
  }, [dispatches, routeFilter, statusFilter]);

  // 통계
  const stats = useMemo(() => {
    let normal = 0;
    let substitute = 0;
    let noService = 0;
    let holiday = 0;

    dispatches.forEach((daily) => {
      daily.routeDispatches.forEach((rd) => {
        if (rd.status === "정상") normal++;
        else if (rd.status === "대체") substitute++;
        else if (rd.status === "운행없음") noService++;
        else if (rd.status === "휴일") holiday++;
      });
    });

    return { normal, substitute, noService, holiday, total: normal + substitute + noService };
  }, [dispatches]);

  // 퀵 날짜 설정
  const setThisMonth = () => {
    const now = new Date();
    setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
  };

  const setThisWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = addDays(now, -dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    const sunday = addDays(monday, 6);
    setStartDate(format(monday, "yyyy-MM-dd"));
    setEndDate(format(sunday, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-6">
      {/* 필터 패널 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 기간 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* 노선 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">노선</label>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">전체 노선</option>
              {settings.routes.map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
          </div>

          {/* 상태 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">전체 상태</option>
              <option value="정상">정상 운행</option>
              <option value="대체">대체 운행</option>
              <option value="운행없음">운행 없음</option>
              <option value="휴일">휴일</option>
            </select>
          </div>
        </div>

        {/* 퀵 버튼 */}
        <div className="mt-4 flex space-x-3">
          <button
            onClick={setThisWeek}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            이번 주
          </button>
          <button
            onClick={setThisMonth}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            이번 달
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-sm text-gray-500">운행일</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.normal}</div>
          <div className="text-sm text-green-600">정상 운행</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{stats.substitute}</div>
          <div className="text-sm text-yellow-600">대체 운행</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{stats.noService}</div>
          <div className="text-sm text-red-600">운행 없음</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{stats.holiday}</div>
          <div className="text-sm text-gray-500">휴일</div>
        </div>
      </div>

      {/* 배차 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  노선
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사유
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  운전자
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  차량
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  탑승 인원
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    해당 기간에 배차 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDispatches.flatMap((daily) =>
                  daily.routeDispatches.map((rd) => (
                    <tr key={`${daily.date}-${rd.routeId}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {format(parseISO(daily.date), "M/d (EEE)", { locale: ko })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{rd.routeName}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            rd.status === "정상"
                              ? "bg-green-100 text-green-800"
                              : rd.status === "대체"
                              ? "bg-yellow-100 text-yellow-800"
                              : rd.status === "휴일"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {rd.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600 max-w-xs">
                          {rd.reason || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rd.driver?.driverName || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {rd.driver?.vehicleName || "-"}
                          {rd.driver?.vehicleCapacity && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({rd.driver.vehicleCapacity}인승)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {rd.passengers.length > 0 ? (
                            <span className="inline-flex items-center">
                              <span className="font-medium">{rd.passengers.length}명</span>
                              <span className="ml-2 text-gray-500 text-xs">
                                ({rd.passengers.map((p) => p.name).join(", ")})
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
