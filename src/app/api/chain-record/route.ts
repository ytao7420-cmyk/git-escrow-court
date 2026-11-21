import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { parseGenLayerTransaction } from "@/lib/genlayer-tx";

export const runtime = "nodejs";

const CONTRACT = "0x37383a73306B8F31d9158C3419C29EED856cc1Bc";
const CASE_TX = "0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7";
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
    const tx = await rpc("eth_getTransactionByHash", [CASE_TX]);
    const receipt = await rpc("eth_getTransactionReceipt", [CASE_TX]).catch(() => null);
    return Response.json({
      ok: true,
      source: RPC,
      methods: ["get_owner", "list_cases", "get_record", "eth_getTransactionByHash"],
      contract: CONTRACT,
      owner: String(owner),
      caseIds,
      records,
      transaction: parseGenLayerTransaction(tx, receipt, CASE_TX),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "chain read failed";
    return Response.json({ ok: false, error: message, source: RPC, contract: CONTRACT }, { status: 502 });
  }
}
