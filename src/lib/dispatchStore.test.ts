/**
 * 배차 설정 저장소 복원 테스트 — `node --test src/lib/dispatchStore.test.ts`
 *
 * 왜 이걸 테스트하나: 배차 화면은 isHydrated가 켜질 때까지 "배차 정보를 불러오는 중..."만
 * 보여준다. 저장값이 깨져 복원에 실패했을 때 그 플래그를 안 켜면, 그 브라우저에서는
 * 배차관리가 영원히 안 열린다. 화면을 띄워야만 보이는 자리라 여기서 못박는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/** localStorage 대역 — getItem이 무엇을 돌려줄지 시험마다 바꾼다 */
function stubStorage(getItem: () => string | null) {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
        getItem,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    } as unknown as Storage;
}

/** import 캐시를 피해 매번 새 모듈로 읽는다 */
async function freshStore() {
    const mod = await import(`./dispatchStore.ts?t=${Date.now()}-${Math.random()}`);
    await new Promise((r) => setTimeout(r, 0)); // queueMicrotask가 도는 틈
    return mod.useDispatchStore;
}

test('저장값이 깨져 있어도 화면은 열린다 — 안 그러면 배차관리가 영원히 로딩이다', async () => {
    stubStorage(() => '{깨진 JSON');
    const useDispatchStore = await freshStore();
    assert.equal(useDispatchStore.getState().isHydrated, true,
        '복원에 실패했는데 isHydrated가 false다 — 배차 화면이 "배차 정보를 불러오는 중..."에서 멈춘다');
    // 기본값으로 열려야 한다
    assert.ok(Array.isArray(useDispatchStore.getState().settings.routes));
});

test('저장값이 없어도(첫 방문) 화면은 열린다', async () => {
    stubStorage(() => null);
    const useDispatchStore = await freshStore();
    assert.equal(useDispatchStore.getState().isHydrated, true);
});

test('멀쩡한 저장값은 그대로 복원된다', async () => {
    stubStorage(() => JSON.stringify({
        state: { settings: { routes: [{ id: 'r1', name: '1호차' }], seniors: [], employees: [] }, seniorAbsences: [] },
        version: 0,
    }));
    const useDispatchStore = await freshStore();
    assert.equal(useDispatchStore.getState().isHydrated, true);
    assert.equal(useDispatchStore.getState().settings.routes[0]?.name, '1호차');
});
