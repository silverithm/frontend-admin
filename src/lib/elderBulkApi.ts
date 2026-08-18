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

import { authorizedFetch, addCompanyElder } from '@/lib/apiService';

export interface BulkElderInput {
  name: string;
  homeAddress?: string;
  requiredFrontSeat?: boolean;
}

export interface BulkRegisterResult {
  created: number;
  failed: { input: BulkElderInput; message: string }[];
  /** bulk 엔드포인트가 없어 단건 폴백으로 처리했는지 (결과 안내용) */
  usedFallback: boolean;
}

const FALLBACK_CONCURRENCY = 5;

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

export async function bulkRegisterElders(
  elders: BulkElderInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkRegisterResult> {
  const companyId = getCompanyId();
  if (!companyId) {
    throw new Error('Company ID가 필요합니다. 다시 로그인해주세요.');
  }
  if (elders.length === 0) {
    return { created: 0, failed: [], usedFallback: false };
  }

  const payload = elders.map((e) => ({
    name: e.name,
    homeAddress: e.homeAddress || '',
    requiredFrontSeat: e.requiredFrontSeat || false,
  }));

  try {
    const data = await authorizedFetch(`/v1/elders/company/bulk?companyId=${companyId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    onProgress?.(elders.length, elders.length);
    const created = typeof data?.created === 'number' ? data.created : elders.length;
    return { created, failed: [], usedFallback: false };
  } catch (error) {
    if (!isBulkUnsupported(error)) {
      // bulk는 전체가 한 트랜잭션 — 실패하면 아무도 등록되지 않았다
      throw new Error(`등록에 실패했습니다: ${errorMessage(error)} (등록된 인원 없음)`);
    }
  }

  // ── 폴백: 구백엔드 — 단건 API를 동시 5건으로 나눠 보낸다 ──
  let done = 0;
  const failed: BulkRegisterResult['failed'] = [];

  const registerOne = async (input: BulkElderInput) => {
    try {
      await addCompanyElder({
        name: input.name,
        homeAddress: input.homeAddress || undefined,
        requiredFrontSeat: input.requiredFrontSeat || false,
      });
    } catch (error) {
      failed.push({ input, message: errorMessage(error) });
    } finally {
      done += 1;
      onProgress?.(done, elders.length);
    }
  };

  for (let i = 0; i < elders.length; i += FALLBACK_CONCURRENCY) {
    // 같은 묶음 안에서는 동시에, 묶음 사이는 순차로 — 동시 요청을 5건으로 묶는 방법
    await Promise.all(elders.slice(i, i + FALLBACK_CONCURRENCY).map(registerOne));
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
          requiredFrontSeat: input.requiredFrontSeat || false,
        });
      } catch (error) {
        failed.push({ input, message: errorMessage(error) });
      }
    }
  }

  return { created: elders.length - failed.length, failed, usedFallback: true };
}
