"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiSearch, FiUser } from "react-icons/fi";
import { getMemberUsers, getPositions } from "@/lib/apiService";
import type { Position } from "@/types/position";
import {
  ALL_ROLE_FILTER,
  buildRoleNames,
  getMemberRoleName,
  getRoleDisplayName,
  type MemberRoleSource,
} from "@/lib/roleUtils";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";

export interface Member extends MemberRoleSource {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface MemberSelectorProps {
  onSelect: (member: Member) => void;
  selectedMember: Member | null;
}

type BadgeVariant =
  | "neutral"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "pink"
  | "cyan";

const ROLE_VARIANT_PALETTE: BadgeVariant[] = [
  "blue",
  "green",
  "orange",
  "purple",
  "pink",
  "cyan",
];

function hashRoleName(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getRoleBadgeVariant(role?: string | null): BadgeVariant {
  const normalizedRole = (role ?? "").trim();

  if (!normalizedRole) {
    return "neutral";
  }
  if (normalizedRole === "admin") {
    return "purple";
  }
  if (normalizedRole === "caregiver") {
    return "blue";
  }
  if (normalizedRole === "office") {
    return "green";
  }

  return ROLE_VARIANT_PALETTE[
    hashRoleName(normalizedRole) % ROLE_VARIANT_PALETTE.length
  ];
}

const MemberSelector: React.FC<MemberSelectorProps> = ({
  onSelect,
  selectedMember,
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLE_FILTER);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const availableRoles = useMemo(
    () =>
      buildRoleNames({
        positions,
        members,
        includeAdmin: true,
      }),
    [members, positions]
  );

  const filteredMembers = useMemo(() => {
    let filtered = [...members];

    if (searchTerm) {
      const loweredSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (member) =>
          member.name.toLowerCase().includes(loweredSearchTerm) ||
          member.email.toLowerCase().includes(loweredSearchTerm)
      );
    }

    if (roleFilter !== ALL_ROLE_FILTER) {
      filtered = filtered.filter(
        (member) => getMemberRoleName(member) === roleFilter
      );
    }

    return filtered.filter(
      (member) => !member.status || member.status === "active"
    );
  }, [members, roleFilter, searchTerm]);

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [membersData, positionsData] = await Promise.all([
        getMemberUsers(),
        getPositions().catch(() => ({ positions: [] })),
      ]);

      const membersArray = membersData?.members || membersData || [];
      const positionsArray = positionsData?.positions || [];
      const validMembers = Array.isArray(membersArray) ? membersArray : [];
      const validPositions = Array.isArray(positionsArray) ? positionsArray : [];

      setMembers(validMembers);
      setPositions(validPositions);
    } catch (err) {
      console.error("직원 목록 조회 오류:", err);
      setError(
        err instanceof Error
          ? err.message
          : "직원 목록을 불러오는데 실패했습니다."
      );
      setMembers([]);
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <VStack vAlign="center" hAlign="center" height={256}>
        <Spinner size="lg" label="직원 목록을 불러오는 중..." />
      </VStack>
    );
  }

  if (error) {
    return (
      <Banner
        status="error"
        title="직원 목록을 불러오지 못했습니다"
        description={error}
        endContent={
          <Button label="다시 시도" variant="secondary" onClick={fetchMembers} />
        }
      />
    );
  }

  return (
    <VStack gap={4}>
      <VStack gap={3}>
        <TextInput
          label="이름 또는 이메일로 검색"
          isLabelHidden
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
          placeholder="이름 또는 이메일로 검색..."
          startIcon={FiSearch}
        />

        <HStack gap={2} wrap="wrap">
          {[ALL_ROLE_FILTER, ...availableRoles].map((roleName) => (
            <Button
              key={roleName}
              label={
                roleName === ALL_ROLE_FILTER
                  ? "전체"
                  : getRoleDisplayName(roleName)
              }
              variant={roleFilter === roleName ? "primary" : "secondary"}
              size="sm"
              onClick={() => setRoleFilter(roleName)}
            />
          ))}
        </HStack>
      </VStack>

      <div
        style={{
          maxHeight: 384,
          overflowY: "auto",
          paddingRight: 'var(--spacing-2)',
        }}
      >
        {filteredMembers.length === 0 ? (
          <VStack vAlign="center" hAlign="center" gap={2} height={192}>
            <Icon icon={FiUser} size="lg" color="tertiary" />
            <Text type="supporting">조건에 맞는 직원이 없습니다.</Text>
          </VStack>
        ) : (
          <VStack gap={2}>
            {filteredMembers.map((member) => {
              const roleName = getMemberRoleName(member);
              const isSelected = selectedMember?.id === member.id;

              return (
                <div
                  key={member.id}
                  onClick={() => onSelect(member)}
                  className={isSelected ? undefined : "carev-member-item"}
                  style={{
                    padding: 'var(--spacing-4)',
                    borderRadius: 'var(--radius-inner)',
                    cursor: "pointer",
                    transition: 'all var(--duration-fast-min) var(--ease-standard)',
                    border: isSelected
                      ? "1px solid #14b8a6"
                      : "1px solid #e5e7eb",
                    background: isSelected ? 'var(--color-background-teal)' : "#ffffff",
                  }}
                >
                  <HStack hAlign="between" vAlign="center" gap={3}>
                    <HStack gap={3} vAlign="center">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-background-muted)',
                          flexShrink: 0,
                        }}
                      >
                        <Icon icon={FiBriefcase} size="sm" color="secondary" />
                      </div>
                      <VStack gap={0.5}>
                        <Text weight="medium">{member.name}</Text>
                        <Text type="supporting">{member.email}</Text>
                      </VStack>
                    </HStack>
                    <Badge
                      variant={getRoleBadgeVariant(roleName)}
                      label={getRoleDisplayName(roleName)}
                    />
                  </HStack>
                </div>
              );
            })}
          </VStack>
        )}
      </div>

      {selectedMember && (
        <Banner
          status="success"
          title="선택된 직원"
          description={`${selectedMember.name} (${getRoleDisplayName(
            getMemberRoleName(selectedMember)
          )})`}
        />
      )}
    </VStack>
  );
};

export default MemberSelector;
