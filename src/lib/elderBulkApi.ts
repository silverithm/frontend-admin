/**
 * 어르신 대량 등록 API.
 *
 * 신형 백엔드의 bulk 엔드포인트(한 번의 요청·한 트랜잭션)를 먼저 시도하고,
 * 아직 배포되지 않은 백엔드(404/405)면 기존 단건 등록 API로 나눠 보내는
 * 폴백까지 이 파일이 책임진다. 호출하는 쪽은 진행률 콜백만 넘기면 된다.
 *
 * 폴백은 동시 5건으로 제한한다 — 수백 건을 한꺼번에 쏘면 브라우저 연결 한도와
 * 서버가 같이 밀리고, 실패가 나도 어느 행인지 알 수 없게 된다.
 */

import { authorizedFetch, addCompanyElder, updateElderCareProfile } from '@/lib/apiService';
import type { ElderCareProfileInput } from '@/types/elderly';

export interface BulkElderInput {
  name: string;
  homeAddress?: string;
  /** 엑셀에 케어 열이 채워져 있던 행만 갖는다 — 없으면 프로필을 만들지 않는다 */
  careProfile?: ElderCareProfileInput;
  /**
   * 이미 등록된 어르신의 id. careProfile과 함께 들어오면 새로 만들지 않고
   * 그분의 케어 정보만 채운다 (이미 등록된 82명처럼 명단은 있는데 케어 정보가 빈 경우).
   * 주소는 갱신하지 않는다 — 기존 주소에 딸린 배차 좌표가 어긋나기 때문.
   */
  existingId?: number;
}

export interface BulkRegisterResult {
  /** 새로 만든 인원 */
  created: number;
  /** 기존 어르신에게 케어 정보를 채운 인원 */
  filled: number;
  failed: { input: BulkElderInput; message: string }[];
  /** bulk 엔드포인트가 없어 단건 폴백으로 처리했는지 (결과 안내용) */
  usedFallback: boolean;
}

const FALLBACK_CONCURRENCY = 5;
/** 케어 정보 채우기도 같은 이유로 동시 5건까지만 (단건 PUT을 사람 수만큼 보낸다) */
const FILL_CONCURRENCY = 5;

function getCompanyId(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('companyId') || '' : '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류';
}

/** bulk 미지원 백엔드 판별 — 엔드포인트 자체가 없을 때만 폴백한다 */
function isBulkUnsupported(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 404 || status === 405 || status === 501;
}

/** 이미 등록된 어르신에게 케어 정보만 채운다. 실패는 모아서 돌려준다. */
async function fillCareProfiles(
  fills: BulkElderInput[],
  onEach: () => void,
): Promise<{ filled: number; failed: BulkRegisterResult['failed'] }> {
  const failed: BulkRegisterResult['failed'] = [];

  const fillOne = async (input: BulkElderInput) => {
    try {
      await updateElderCareProfile(input.existingId!, input.careProfile!);
    } catch (error) {
      failed.push({ input, message: errorMessage(error) });
    } finally {
      onEach();
    }
  };

  for (let i = 0; i < fills.length; i += FILL_CONCURRENCY) {
    // 같은 묶음 안에서는 동시에, 묶음 사이는 순차로 — 동시 요청을 5건으로 묶는 방법
    await Promise.all(fills.slice(i, i + FILL_CONCURRENCY).map(fillOne));
  }

  return { filled: fills.length - failed.length, failed };
}

export async function bulkRegisterElders(
  elders: BulkElderInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkRegisterResult> {
  // 기존 어르신 채우기와 신규 등록은 부르는 API가 다르다 — 여기서 갈라 처리한다
  const fills = elders.filter((e) => e.existingId !== undefined && e.careProfile);
  const creates = elders.filter((e) => !(e.existingId !== undefined && e.careProfile));
  const total = elders.length;
  let progressDone = 0;
  const tick = () => {
    progressDone += 1;
    onProgress?.(progressDone, total);
  };

  if (total === 0) {
    return { created: 0, filled: 0, failed: [], usedFallback: false };
  }

  if (creates.length === 0) {
    // 채우기만 하는 경우엔 companyId도, bulk 엔드포인트도 필요 없다
    const { filled, failed } = await fillCareProfiles(fills, tick);
    return { created: 0, filled, failed, usedFallback: false };
  }

  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }

  const payload = creates.map((e) => ({
    name: e.name,
    homeAddress: e.homeAddress || '',
    // 키 자체를 빼야 서버가 '프로필 없음'으로 본다 (빈 객체는 빈 프로필을 만든다)
    ...(e.careProfile ? { careProfile: e.careProfile } : {}),
  }));

  try {
    const data = await authorizedFetch(`/v1/elders/company/bulk?companyId=${companyId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    for (let i = 0; i < creates.length; i += 1) tick();
    const created = typeof data?.created === 'number' ? data.created : creates.length;
    const { filled, failed } = await fillCareProfiles(fills, tick);
    return { created, filled, failed, usedFallback: false };
  } catch (error) {
    if (!isBulkUnsupported(error)) {
      // bulk는 전체가 한 트랜잭션 — 실패하면 아무도 등록되지 않았다.
      // 채우기는 아직 시작도 하지 않았으니 그대로 되돌려 다시 시도하게 한다.
      throw new Error(`등록에 실패했습니다: ${errorMessage(error)} (등록된 인원 없음)`);
    }
  }

  // ── 폴백: 구백엔드 — 단건 API를 동시 5건으로 나눠 보낸다 ──
  const failed: BulkRegisterResult['failed'] = [];

  const registerOne = async (input: BulkElderInput) => {
    try {
      await addCompanyElder({
        name: input.name,
        homeAddress: input.homeAddress || undefined,
        careProfile: input.careProfile,
      });
    } catch (error) {
      failed.push({ input, message: errorMessage(error) });
    } finally {
      tick();
    }
  };

  for (let i = 0; i < creates.length; i += FALLBACK_CONCURRENCY) {
    // 같은 묶음 안에서는 동시에, 묶음 사이는 순차로 — 동시 요청을 5건으로 묶는 방법
    await Promise.all(creates.slice(i, i + FALLBACK_CONCURRENCY).map(registerOne));
  }

  // 일시적 오류였을 수 있으니 실패분은 한 번만 순차로 재시도한다
  if (failed.length > 0) {
    const firstFailed = [...failed];
    failed.length = 0;
    for (const { input } of firstFailed) {
      try {
        await addCompanyElder({
          name: input.name,
          homeAddress: input.homeAddress || undefined,
          careProfile: input.careProfile,
        });
      } catch (error) {
        failed.push({ input, message: errorMessage(error) });
      }
    }
  }

  const created = creates.length - failed.length;
  const fillResult = await fillCareProfiles(fills, tick);
  failed.push(...fillResult.failed);

  return { created, filled: fillResult.filled, failed, usedFallback: true };
}
