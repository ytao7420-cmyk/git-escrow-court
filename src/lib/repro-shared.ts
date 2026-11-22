export const REPRO_CASE_ID = "repro-missing-log-v1";
export const HISTORICAL_CASE_ID = "public-0726369d528e";
export const COURT_ADDRESS = "0x37383a73306B8F31d9158C3419C29EED856cc1Bc";
export const REPRO_STORAGE_KEY = "gec-repro-case-v1";
export const FEE_CAP_WEI = 1000000000000000n;
export const SCHEMA_TEXT = "string commitHash,uint8 commitAlgo,string[] hosts";

export type ReproGuard = {
  hash: string | null;
  locked: boolean;
  lines: string[];
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function hashOrNull(value: unknown): string | null {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value) ? value : null;
}

export function emptyReproGuard(): ReproGuard {
  return { hash: null, locked: false, lines: [] };
}

export function loadReproGuard(storage: StorageLike | null): ReproGuard {
  if (!storage) return emptyReproGuard();
  const raw = storage.getItem(REPRO_STORAGE_KEY);
  if (!raw) return emptyReproGuard();
  try {
    const parsed = JSON.parse(raw) as Partial<ReproGuard>;
    const lines = Array.isArray(parsed.lines) ? parsed.lines.map(String) : [];
    const hash = hashOrNull(parsed.hash);
    if (hash) return { hash, locked: true, lines };
    if (parsed.locked === true) return { hash: null, locked: true, lines };
    return { hash: null, locked: false, lines };
  } catch {
    return {
      hash: null,
      locked: true,
      lines: ["本地复现记录读不出来。发送保持关闭，避免在未知状态下再写一笔。"],
    };
  }
}

export function saveReproGuard(storage: StorageLike | null, guard: ReproGuard) {
  storage?.setItem(REPRO_STORAGE_KEY, JSON.stringify(guard));
}
