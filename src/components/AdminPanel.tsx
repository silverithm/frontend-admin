"use client";
import { useState, useEffect, useMemo } from "react";
import { VacationLimit, DayInfo } from "@/types/vacation";
import type { Position } from "@/types/position";
import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { getPositions, saveVacationLimits } from "@/lib/apiService";
import {
  ALL_ROLE_FILTER,
  buildRoleNames,
  getRoleDisplayName,
} from "@/lib/roleUtils";

interface AdminPanelProps {
  currentDate: Date;
  onClose: () => void;
  onUpdateSuccess: () => void | Promise<void>;
  vacationLimits?: Record<string, VacationLimit>;
  vacationDays?: Record<string, DayInfo>;
}

const AdminPanel = ({
  currentDate,
  onClose,
  onUpdateSuccess,
}: AdminPanelProps) => {
  const [panelDate, setPanelDate] = useState(currentDate);
  const [limits, setLimits] = useState<VacationLimit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>(ALL_ROLE_FILTER);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  const availableRoles = useMemo(
    () => buildRoleNames({ positions, limits }),
    [positions, limits]
  );

  useEffect(() => {
    setPanelDate(currentDate); // 모달 열릴 때 부모 값으로 초기화
  }, [currentDate]);

  useEffect(() => {
    fetchPanelData();
  }, [panelDate]);

  useEffect(() => {
    if (activeFilter === ALL_ROLE_FILTER) return;

    if (!availableRoles.includes(activeFilter)) {
      setActiveFilter(availableRoles[0] || ALL_ROLE_FILTER);
    }
  }, [activeFilter, availableRoles]);

  const fetchPanelData = async () => {
    try {
      const monthStart = startOfMonth(panelDate);
      const monthEnd = endOfMonth(panelDate);

      // JWT 토큰과 companyId 가져오기
      const token = localStorage.getItem("authToken");
      const companyId = localStorage.getItem("companyId");

      if (!companyId) {
        throw new Error("회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.");
      }

      const headers: Record<string, string> = {};

      // JWT 토큰이 있으면 Authorization 헤더 추가
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const [response, positionsData] = await Promise.all([
        fetch(
          `/api/vacation/limits?start=${format(
            monthStart,
            "yyyy-MM-dd"
          )}&end=${format(monthEnd, "yyyy-MM-dd")}&companyId=${companyId}`,
          {
            headers,
          }
        ),
        getPositions().catch(() => ({ positions: [] })),
      ]);

      if (!response.ok) {
        throw new Error("휴무 제한 정보를 가져오는데 실패했습니다.");
      }

      const data = await response.json();
      const existingLimits = Array.isArray(data.limits) ? data.limits : [];
      const positionList = Array.isArray(positionsData?.positions)
        ? (positionsData.positions as Position[])
        : [];
      const roleNames = buildRoleNames({ positions: positionList, limits: existingLimits });
      const allLimits: VacationLimit[] = [];

      setPositions(positionList);

      let currentDay = monthStart;
      while (currentDay <= monthEnd) {
        const dateStr = format(currentDay, "yyyy-MM-dd");
        roleNames.forEach((roleName) => {
          const matchedLimit = existingLimits.find(
            (limit: VacationLimit) =>
              limit.date === dateStr && limit.role === roleName
          );

          allLimits.push({
            id: matchedLimit?.id,
            date: dateStr,
            maxPeople:
              matchedLimit?.maxPeople !== undefined
                ? matchedLimit.maxPeople
                : 3,
            createdAt: matchedLimit?.createdAt,
            role: roleName,
          });
        });

        currentDay = addDays(currentDay, 1);
      }
      setLimits(allLimits);
    } catch (err) {
      console.error("휴가 제한 조회 오류:", err);
      setError("휴가 제한 조회에 실패했습니다.");
    }
  };

  const handleUpdateLimit = (
    date: string,
    role: string,
    value: number
  ) => {
    const idx = limits.findIndex((l) => l.date === date && l.role === role);
    if (idx === -1) return;
    const newLimits = [...limits];
    newLimits[idx] = { ...newLimits[idx], maxPeople: value };
    setLimits(newLimits);
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      setIsSubmitting(true);
      setError("");

      // companyId 가져오기
      const companyId = localStorage.getItem("companyId");

      if (!companyId) {
        throw new Error("회사 ID를 찾을 수 없습니다. 다시 로그인해주세요.");
      }

      const saveLimits = limits.filter((limit) => limit.role.trim().length > 0);

      await saveVacationLimits(saveLimits);

      // 성공 후 최신 데이터 새로고침
      await onUpdateSuccess();

      setMessage({ type: "success", text: "휴무 제한 설정이 저장되었습니다!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("제한 저장 오류:", err);
      setError("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
      setMessage({ type: "error", text: "저장 중 오류가 발생했습니다." });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-xl border border-gray-200">
      <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPanelDate((prev) => subMonths(prev, 1))}
            className="px-3 py-2 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-700 transition-all duration-200 flex items-center justify-center"
            disabled={isSaving || isSubmitting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">
            {format(panelDate, "yyyy년 MM월", { locale: ko })} 휴가 제한 설정
          </h2>
          <button
            onClick={() => setPanelDate((prev) => addMonths(prev, 1))}
            className="px-3 py-2 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-700 transition-all duration-200 flex items-center justify-center"
            disabled={isSaving || isSubmitting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-red-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          disabled={isSaving || isSubmitting}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 shadow-sm">
          {error}
        </div>
      )}
      {message && message.type === "success" && (
        <div className="mb-4 p-3 bg-teal-50 text-teal-700 rounded-lg border border-teal-200 shadow-sm flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {message.text}
        </div>
      )}

      {/* 로딩 인디케이터 */}
      {(isSaving || isSubmitting) && (
        <div className="mb-4 p-3 bg-teal-50 text-teal-600 rounded-md border border-teal-200 shadow-sm flex items-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-teal-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          저장 중... 기다려주세요.
        </div>
      )}

      <div className="flex justify-center mb-6">
        <div className="inline-flex flex-wrap justify-center gap-1 bg-gray-100 p-1 rounded-lg shadow-sm">
          <button
            onClick={() => setActiveFilter(ALL_ROLE_FILTER)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1
              ${
                activeFilter === ALL_ROLE_FILTER
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
          >
            전체
          </button>
          {availableRoles.map((role) => (
            <button
              key={role}
              onClick={() => setActiveFilter(role)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1
              ${
                activeFilter === role
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {getRoleDisplayName(role)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[60vh] mb-6">
        {availableRoles.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            설정할 역할이 없습니다.
            <br />
            회원관리의 역할관리에서 역할을 먼저 등록해주세요.
          </div>
        ) : activeFilter === ALL_ROLE_FILTER ? (
          <div className="text-center text-gray-500 py-8">
            역할을 선택하면 해당 역할별 휴가 제한을 설정할 수 있습니다.
            <br />
            회원관리의 역할관리에서 등록한 역할이 여기서 함께 표시됩니다.
          </div>
        ) : (
          <table className="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase">날짜</th>
                <th className="p-3 border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase">
                  {getRoleDisplayName(activeFilter)} 최대 인원
                </th>
              </tr>
            </thead>
            <tbody>
              {limits
                .filter((l) => l.role === activeFilter)
                .map((limit, index) => (
                  <tr
                    key={limit.date + limit.role}
                    className={
                      index % 2 === 0
                        ? "bg-white hover:bg-gray-50"
                        : "bg-gray-50/50 hover:bg-gray-100"
                    }
                  >
                    <td className="p-3 border-b border-gray-200">
                      <span className="text-gray-900 font-medium">
                        {format(new Date(limit.date), "yyyy-MM-dd (EEE)", {
                          locale: ko,
                        })}
                      </span>
                    </td>
                    <td className="p-3 border-b border-gray-200">
                      <input
                        type="number"
                        min="0"
                        value={limit.maxPeople}
                        placeholder={`${getRoleDisplayName(activeFilter)} 인원`}
                        onChange={(e) =>
                          handleUpdateLimit(
                            limit.date,
                            limit.role,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full p-2 border border-gray-200 rounded-lg text-gray-900 font-medium focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                        disabled={isSaving || isSubmitting}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={onClose}
          className="px-5 py-2.5 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving || isSubmitting}
        >
          취소
        </button>
        <button
          onClick={saveChanges}
          className="px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 transition-colors disabled:cursor-not-allowed flex items-center"
          disabled={isSaving || isSubmitting || availableRoles.length === 0}
        >
          {isSaving || isSubmitting ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              저장 중...
            </>
          ) : (
            "저장"
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;
