export const HISTORICAL_CASE_ID = "public-0726369d528e";
export const COURT_ADDRESS = "0x37383a73306B8F31d9158C3419C29EED856cc1Bc";
export const REPRO_STORAGE_KEY = "gec-repro-case-v1";
export const FEE_CAP_WEI = 1000000000000000n;
export const SCHEMA_TEXT = "string commitHash,uint8 commitAlgo,string[] hosts";
const REPRO_CASE_PATTERN = /^repro-[0-9a-f]{32}$/;

export type ReproGuard = {
  caseId: string | null;
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

export function isReproCaseId(value: string): boolean {
  return REPRO_CASE_PATTERN.test(value) && value !== HISTORICAL_CASE_ID;
}

export function createReproCaseId(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error("a repro case id needs 16 random bytes");
  const hex = [...bytes].map((item) => item.toString(16).padStart(2, "0")).join("");
  return `repro-${hex}`;
}

export function reproClickAllowed(guard: ReproGuard): boolean {
  return Boolean(guard.caseId && isReproCaseId(guard.caseId) && !guard.locked && !guard.hash);
}

export function emptyReproGuard(): ReproGuard {
  return { caseId: null, hash: null, locked: false, lines: [] };
}

export function loadReproGuard(storage: StorageLike | null): ReproGuard {
  if (!storage) return emptyReproGuard();
  const raw = storage.getItem(REPRO_STORAGE_KEY);
  if (!raw) return emptyReproGuard();
  try {
    const parsed = JSON.parse(raw) as Partial<ReproGuard>;
    const lines = Array.isArray(parsed.lines) ? parsed.lines.map(String) : [];
    const hash = hashOrNull(parsed.hash);
    const caseId = typeof parsed.caseId === "string" && isReproCaseId(parsed.caseId) ? parsed.caseId : null;
    if (typeof parsed.caseId === "string" && !caseId) {
      return { caseId: null, hash, locked: true, lines: [...lines, "保存的案件 id 无效。发送保持关闭。"] };
    }
    if (hash) return { caseId, hash, locked: true, lines };
    if (parsed.locked === true) return { caseId, hash: null, locked: true, lines };
    return { caseId, hash: null, locked: false, lines };
  } catch {
    return {
      caseId: null,
      hash: null,
      locked: true,
      lines: ["本地复现记录读不出来。发送保持关闭，避免在未知状态下再写一笔。"],
    };
  }
}

export function saveReproGuard(storage: StorageLike | null, guard: ReproGuard) {
  storage?.setItem(REPRO_STORAGE_KEY, JSON.stringify(guard));
}
