"use client";

import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { motion } from "framer-motion";
import type { DailyDispatch, RouteDispatch } from "@/types/dispatch";
import { isNonWorkingDay } from "@/lib/dispatchAlgorithm";

interface DispatchDayDetailProps {
  dispatch: DailyDispatch | null;
  onClose: () => void;
}

export default function DispatchDayDetail({ dispatch, onClose }: DispatchDayDetailProps) {
  if (!dispatch) return null;

  const date = parseISO(dispatch.date);

  // 휴일 체크
  const holidayInfo = isNonWorkingDay(dispatch.date);

  // 상태별 스타일
  const getStatusStyle = (status: RouteDispatch["status"]) => {
    switch (status) {
      case "정상":
        return {
          bg: "bg-green-50",
          border: "border-green-200",
          badge: "bg-green-100 text-green-800",
          icon: "text-green-500",
        };
      case "대체":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          badge: "bg-yellow-100 text-yellow-800",
          icon: "text-yellow-500",
        };
      case "운행없음":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          badge: "bg-red-100 text-red-800",
          icon: "text-red-500",
        };
      case "휴일":
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          badge: "bg-gray-100 text-gray-800",
          icon: "text-gray-500",
        };
    }
  };

  return (
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
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
      >
        {/* 헤더 */}
        <div className={`${holidayInfo.isHoliday ? "bg-gradient-to-r from-gray-500 to-gray-600" : "bg-gradient-to-r from-blue-600 to-indigo-600"} text-white px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {format(date, "yyyy년 M월 d일 (EEEE)", { locale: ko })}
              </h2>
              {holidayInfo.isHoliday ? (
                <p className="text-gray-200 text-sm mt-1">
                  {holidayInfo.holidayName} - 휴무
                </p>
              ) : (
                <p className="text-blue-100 text-sm mt-1">
                  총 {dispatch.routeDispatches.length}개 노선 배차표
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 통계 요약 */}
        {holidayInfo.isHoliday ? (
          <div className="px-6 py-8 bg-gray-50 border-b border-gray-200 text-center">
            <div className="text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <p className="text-lg font-medium text-gray-700">{holidayInfo.holidayName}</p>
              <p className="text-sm text-gray-500 mt-1">오늘은 휴무일입니다</p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm text-gray-600">
                  정상 운행: {dispatch.routeDispatches.filter((r) => r.status === "정상").length}개
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                <span className="text-sm text-gray-600">
                  대체 운행: {dispatch.routeDispatches.filter((r) => r.status === "대체").length}개
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <span className="text-sm text-gray-600">
                  운행 없음: {dispatch.routeDispatches.filter((r) => r.status === "운행없음").length}개
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 배차 목록 */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-200px)]">
          {dispatch.routeDispatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              등록된 노선이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {dispatch.routeDispatches.map((routeDispatch) => {
                const style = getStatusStyle(routeDispatch.status);

                return (
                  <div
                    key={routeDispatch.routeId}
                    className={`${style.bg} ${style.border} border rounded-lg p-4`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        {/* 상태 아이콘 */}
                        <div className={`mr-3 ${style.icon}`}>
                          {routeDispatch.status === "정상" && (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {routeDispatch.status === "대체" && (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          {routeDispatch.status === "운행없음" && (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800">{routeDispatch.routeName} 노선</h3>
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${style.badge}`}>
                            {routeDispatch.status}
                            {routeDispatch.driverRole && routeDispatch.status === "대체" && (
                              <> ({routeDispatch.driverRole})</>
                            )}
                          </span>
                          {/* 배차 사유 표시 */}
                          {routeDispatch.reason && (
                            <p className="text-xs text-gray-600 mt-1">
                              {routeDispatch.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {routeDispatch.status !== "운행없음" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 운전자 정보 */}
                        <div className="bg-white/60 rounded-lg p-3">
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-600">운전자</span>
                          </div>
                          <p className="text-gray-800 font-semibold">
                            {routeDispatch.driver?.driverName || "-"}
                          </p>
                          {routeDispatch.status === "대체" && routeDispatch.originalMainDriver && (
                            <p className="text-xs text-gray-500 mt-1">
                              (원래: {routeDispatch.originalMainDriver.driverName} 휴무)
                            </p>
                          )}
                        </div>

                        {/* 차량 정보 */}
                        <div className="bg-white/60 rounded-lg p-3">
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span className="text-sm font-medium text-gray-600">차량</span>
                          </div>
                          <p className="text-gray-800 font-semibold">
                            {routeDispatch.driver?.vehicleName || "-"}
                            {routeDispatch.driver?.vehicleCapacity && (
                              <span className="text-sm text-gray-500 ml-1">
                                ({routeDispatch.driver.vehicleCapacity}인승)
                              </span>
                            )}
                          </p>
                        </div>

                        {/* 탑승 어르신 */}
                        <div className="md:col-span-2 bg-white/60 rounded-lg p-3">
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-600">
                              탑승 어르신 ({routeDispatch.passengers.length}명)
                            </span>
                          </div>
                          {routeDispatch.passengers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {routeDispatch.passengers.map((senior, index) => (
                                <span
                                  key={senior.id}
                                  className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                                >
                                  <span className="w-5 h-5 flex items-center justify-center bg-gray-300 text-gray-600 rounded-full text-xs mr-1.5">
                                    {index + 1}
                                  </span>
                                  {senior.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">탑승 어르신 없음</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-red-600 font-medium">
                          {routeDispatch.reason || "운행 불가"}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
