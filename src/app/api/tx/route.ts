import { isHash } from "viem";

import { parseGenLayerTransaction } from "@/lib/genlayer-tx";

export const runtime = "nodejs";

const RPC = "https://studio.genlayer.com/api";

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://studio.genlayer.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json()) as { result?: unknown; error?: { message?: unknown } };
  if (!response.ok || body.error) {
    const message = typeof body.error?.message === "string" ? body.error.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body.result ?? null;
}

export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get("hash") ?? "";
  if (!isHash(hash)) {
    return Response.json({ ok: false, error: "需要 0x 加 64 位十六进制交易哈希。" }, { status: 400 });
  }
  try {
    const [tx, receipt] = await Promise.all([
      rpc("eth_getTransactionByHash", [hash]),
      rpc("eth_getTransactionReceipt", [hash]).catch(() => null),
    ]);
    return Response.json(parseGenLayerTransaction(tx, receipt, hash));
  } catch (error) {
    const message = error instanceof Error ? error.message : "lookup failed";
    return Response.json({ ok: false, error: message, hash }, { status: 502 });
  }
}
