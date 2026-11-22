export const HISTORICAL_CASE_TX = "0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7";
export const REPRO_CASE_TX = "0xd72bc727c5a0c16bef3326d0f4a18593b22774f4d5f79553447d4bc6aefeea68";

export const FROZEN_CASE_TXS = [
  {
    caseId: "public-0726369d528e",
    hash: HISTORICAL_CASE_TX,
    note: "历史第三方案件的冻结交易标识。终局状态必须来自这次 RPC。",
  },
  {
    caseId: "repro-237ab1a3788efdecb055ce97ef351eb6",
    hash: REPRO_CASE_TX,
    note: "已经写入的复现案件。这里只核验，不把它变成可以再发送的案件。",
  },
] as const;

export function executionSucceeded(results: string[] | undefined): boolean {
  return Array.isArray(results) && results.length > 0 && results.every((item) => item === "SUCCESS");
}
