import type { Position } from "@/types/position";
import type { VacationLimit, VacationRequest } from "@/types/vacation";

export const ALL_ROLE_FILTER = "all";

const LEGACY_ROLE_LABELS: Record<string, string> = {
  caregiver: "요양보호사",
  office: "사무직",
  admin: "관리자",
  employee: "직원",
  all: "전체",
};

/**
 * 백엔드 VacationRequest.normalizeRole과 동일한 규칙.
 * 휴가 API는 "요양보호사"를 "caregiver"로 정규화해 내려주는 반면 역할(Position) API는 원본 이름을
 * 그대로 주기 때문에, 같은 역할이 두 항목으로 갈라지지 않도록 한쪽 키로 모은다.
 */
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  CAREGIVER: "caregiver",
  ROLE_CAREGIVER: "caregiver",
  요양보호사: "caregiver",
  OFFICE: "office",
  ROLE_OFFICE: "office",
  사무직: "office",
  ADMIN: "admin",
  ROLE_ADMIN: "admin",
  관리자: "admin",
  EMPLOYEE: "employee",
  ROLE_EMPLOYEE: "employee",
  직원: "employee",
};

export function normalizeRoleKey(value?: string | null) {
  const trimmedValue = value?.trim() || "";
  if (!trimmedValue) {
    return "";
  }

  return LEGACY_ROLE_ALIASES[trimmedValue.toUpperCase()] || trimmedValue;
}

const ROLE_BADGE_PALETTE = [
  "bg-blue-50 text-blue-700 border-blue-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-violet-50 text-violet-700 border-violet-100",
  "bg-rose-50 text-rose-700 border-rose-100",
  "bg-cyan-50 text-cyan-700 border-cyan-100",
];

export interface MemberRoleSource {
  id?: string | number | null;
  name?: string | null;
  role?: string | null;
  position?: string | null;
  positionId?: number | null;
}

export interface RoleLookup {
  byId: Map<string, string>;
  byName: Map<string, string>;
}

function normalizeRoleName(value?: string | null) {
  return normalizeRoleKey(value);
}

function shouldIgnoreStoredRole(role: string) {
  return role === "" || role === "employee";
}

function addRoleName(roleNames: string[], seen: Set<string>, role: string) {
  const trimmedRole = normalizeRoleName(role);
  if (!trimmedRole || seen.has(trimmedRole)) {
    return;
  }
  // '전체(all)' 한도 행은 직종이 아니라 날짜 총인원 제한 — 역할 목록에 섞이면 안 된다
  if (trimmedRole.toLowerCase() === ALL_ROLE_FILTER) {
    return;
  }

  seen.add(trimmedRole);
  roleNames.push(trimmedRole);
}

function hashRoleName(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getStoredUserRole() {
  if (typeof window === "undefined") {
    return "";
  }

  const position = normalizeRoleName(localStorage.getItem("userPosition"));
  if (position) {
    return position;
  }

  const role = normalizeRoleName(localStorage.getItem("userRole"));
  return shouldIgnoreStoredRole(role) ? "" : role;
}

export function getMemberRoleName(member?: MemberRoleSource | null) {
  if (!member) {
    return "";
  }

  const position = normalizeRoleName(member.position);
  if (position) {
    return position;
  }

  return normalizeRoleName(member.role);
}

export function buildMemberRoleLookup(members: MemberRoleSource[] = []): RoleLookup {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();

  members.forEach((member) => {
    const roleName = getMemberRoleName(member);
    if (!roleName) {
      return;
    }

    const memberId = member.id?.toString().trim();
    const memberName = normalizeRoleName(member.name);

    if (memberId) {
      byId.set(memberId, roleName);
    }

    if (memberName) {
      byName.set(memberName, roleName);
    }
  });

  return { byId, byName };
}

export function resolveRoleName(options: {
  role?: string | null;
  userId?: string | null;
  userName?: string | null;
  member?: MemberRoleSource | null;
  lookup?: RoleLookup | null;
}) {
  const memberRole = getMemberRoleName(options.member);
  if (memberRole) {
    return memberRole;
  }

  const userId = options.userId?.toString().trim();
  if (userId && options.lookup?.byId.has(userId)) {
    return options.lookup.byId.get(userId) || "";
  }

  const userName = normalizeRoleName(options.userName);
  if (userName && options.lookup?.byName.has(userName)) {
    return options.lookup.byName.get(userName) || "";
  }

  return normalizeRoleName(options.role);
}

export function getRoleDisplayName(role?: string | null) {
  const normalizedRole = normalizeRoleName(role);
  if (!normalizedRole) {
    return "직원";
  }

  return LEGACY_ROLE_LABELS[normalizedRole] || normalizedRole;
}

export function getRoleBadgeClasses(role?: string | null) {
  const normalizedRole = normalizeRoleName(role);

  if (!normalizedRole) {
    return "bg-gray-100 text-gray-600 border-gray-200";
  }

  if (normalizedRole === "admin") {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }

  if (normalizedRole === "caregiver") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (normalizedRole === "office") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  return ROLE_BADGE_PALETTE[hashRoleName(normalizedRole) % ROLE_BADGE_PALETTE.length];
}

export function compareRoleNames(a: string, b: string) {
  return getRoleDisplayName(a).localeCompare(getRoleDisplayName(b), "ko");
}

export function buildRoleNames(options: {
  positions?: Position[];
  members?: MemberRoleSource[];
  requests?: VacationRequest[];
  limits?: VacationLimit[] | Record<string, VacationLimit>;
  includeAdmin?: boolean;
  includeLegacyFallback?: boolean;
}) {
  const {
    positions = [],
    members = [],
    requests = [],
    limits = [],
    includeAdmin = false,
    includeLegacyFallback = true,
  } = options;

  const roleNames: string[] = [];
  const seen = new Set<string>();
  const roleLookup = buildMemberRoleLookup(members);

  positions
    .slice()
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, "ko")
    )
    .forEach((position) => {
      addRoleName(roleNames, seen, position.name);
    });

  members.forEach((member) => {
    const memberRole = getMemberRoleName(member);
    if (!memberRole) {
      return;
    }

    if (!includeAdmin && memberRole === "admin") {
      return;
    }

    addRoleName(roleNames, seen, memberRole);
  });

  requests.forEach((request) => {
    const resolvedRole = resolveRoleName({
      role: request.role,
      userId: request.userId,
      userName: request.userName,
      lookup: roleLookup,
    });

    if (!includeAdmin && resolvedRole === "admin") {
      return;
    }

    addRoleName(roleNames, seen, resolvedRole);
  });

  const limitList = Array.isArray(limits) ? limits : Object.values(limits);
  limitList.forEach((limit) => {
    if (!includeAdmin && limit.role === "admin") {
      return;
    }
    addRoleName(roleNames, seen, limit.role);
  });

  if (includeLegacyFallback && roleNames.length === 0) {
    addRoleName(roleNames, seen, "caregiver");
    addRoleName(roleNames, seen, "office");
  }

  return roleNames;
}

export function getVacationRequestRole(
  request: Pick<VacationRequest, "role" | "userId" | "userName">,
  lookup?: RoleLookup | null
) {
  return resolveRoleName({
    role: request.role,
    userId: request.userId,
    userName: request.userName,
    lookup,
  });
}

export function getMaxRoleLimitForDate(
  limits: Record<string, VacationLimit>,
  date: string,
  roleFilter: string,
  roleNames: string[]
) {
  if (roleFilter !== ALL_ROLE_FILTER) {
    // 서버(VacationService.validateDailyVacationLimit)는 '직종별 한도'와 '전체(all) 한도'를
    // 서로 독립된 두 제약으로 모두 검사한다 — 화면도 둘 중 더 빡빡한(작은) 쪽을 보여줘야
    // "여유 있다"고 나왔다가 실제 신청 시 409로 거부되는 불일치가 없다.
    const roleLimit = limits[`${date}_${roleFilter}`]?.maxPeople;
    const allLimit = limits[`${date}_${ALL_ROLE_FILTER}`]?.maxPeople;
    const candidates = [roleLimit, allLimit].filter(
      (value): value is number => typeof value === "number"
    );
    return candidates.length > 0 ? Math.min(...candidates) : 3;
  }

  // 관리자가 '전체(all)' 한도를 직접 건 날짜는 그 값이 정답 —
  // 서버 검증(validateDailyVacationLimit)이 실제로 쓰는 기준과 표시를 맞춘다
  const allLimit = limits[`${date}_${ALL_ROLE_FILTER}`]?.maxPeople;
  if (typeof allLimit === "number") {
    return allLimit;
  }

  const dailyLimits = roleNames
    .map((roleName) => limits[`${date}_${roleName}`]?.maxPeople)
    .filter((value): value is number => typeof value === "number");

  return dailyLimits.length > 0 ? Math.max(...dailyLimits) : 3;
}
