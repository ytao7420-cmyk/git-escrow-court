import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { parseGenLayerTransaction } from "@/lib/genlayer-tx";
import { FROZEN_CASE_TXS, HISTORICAL_CASE_TX, executionSucceeded } from "@/lib/public-reads";

export const runtime = "nodejs";

const CONTRACT = "0x37383a73306B8F31d9158C3419C29EED856cc1Bc";
const RPC = "https://studio.genlayer.com/api";

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://studio.genlayer.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
  });
  const body = (await response.json()) as { result?: unknown; error?: { message?: unknown } };
  if (!response.ok || body.error) {
    const message = typeof body.error?.message === "string" ? body.error.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body.result ?? null;
}

export async function GET() {
  try {
    const client = createClient({ chain: studionet });
    const owner = await client.readContract({ address: CONTRACT, functionName: "get_owner", args: [] });
    const listedRaw = await client.readContract({ address: CONTRACT, functionName: "list_cases", args: [] });
    const caseIds = JSON.parse(String(listedRaw)) as unknown;
    if (!Array.isArray(caseIds) || caseIds.some((item) => typeof item !== "string")) {
      return Response.json({ ok: false, error: "list_cases 不是字符串数组", raw: String(listedRaw), source: RPC }, { status: 502 });
    }
    const records = [];
    for (const caseId of caseIds) {
      const raw = String(await client.readContract({ address: CONTRACT, functionName: "get_record", args: [caseId] }));
      let record: unknown = null;
      try {
        record = JSON.parse(raw);
      } catch {
        record = null;
      }
      records.push({ caseId, raw, record });
    }
    const reads = await Promise.all(FROZEN_CASE_TXS.map(async (item) => {
      try {
        const tx = await rpc("eth_getTransactionByHash", [item.hash]);
        const receipt = await rpc("eth_getTransactionReceipt", [item.hash]).catch(() => null);
        const transaction = parseGenLayerTransaction(tx, receipt, item.hash);
        return {
          caseId: item.caseId,
          hash: item.hash,
          frozenIdentifier: true,
          note: item.note,
          verified: transaction.found,
          executionOk: executionSucceeded(transaction.executionResults) && transaction.status === "FINALIZED",
          error: transaction.found ? undefined : "这次 RPC 没有找到该交易。没有用冻结记录冒充终局。",
          transaction,
        };
      } catch (error) {
        return {
          caseId: item.caseId,
          hash: item.hash,
          frozenIdentifier: true,
          note: item.note,
          verified: false,
          executionOk: false,
          error: error instanceof Error ? error.message : "交易读取失败。没有用冻结记录冒充终局。",
          transaction: null,
        };
      }
    }));
    const historical = reads.find((item) => item.hash === HISTORICAL_CASE_TX);
    return Response.json({
      ok: true,
      source: RPC,
      methods: ["get_owner", "list_cases", "get_record", "eth_getTransactionByHash"],
      contract: CONTRACT,
      owner: String(owner),
      caseIds,
      records,
      reads,
      transaction: historical?.transaction ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "chain read failed";
    return Response.json({ ok: false, error: message, source: RPC, contract: CONTRACT }, { status: 502 });
  }
}
