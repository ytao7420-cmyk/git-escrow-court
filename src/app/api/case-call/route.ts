import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { canonicalJson, encodePrimary, encodeReviewInner, primaryAddTransaction } from "@/lib/official-primary";

export const runtime = "nodejs";

const SOURCE_SHA = "4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e";

function encode(address: `0x${string}`, argument: unknown, expectedInnerSha: string) {
  const text = canonicalJson(argument);
  const inner = encodeReviewInner(text);
  const innerSha = createHash("sha256").update(Buffer.from(inner.slice(2), "hex")).digest("hex");
  if (innerSha !== expectedInnerSha) {
    return { ok: false as const, error: "review_case 内层编码和冻结哈希不一致。没有发送。" };
  }
  const { to } = primaryAddTransaction();
  const data = encodePrimary(address, inner);
  return {
    ok: true as const,
    transaction: { to, from: "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9", value: "0x0", data, selector: data.slice(0, 10) },
  };
}

export async function GET() {
  const frozen = JSON.parse(readFileSync("fixtures/public/case-submit.json", "utf8")) as {
    contractSourceSha256: string;
    expectedDecision: string;
    caseId: string;
    attestationUid: string;
    argumentSha256: string;
    innerTxDataSha256: string;
    outerSelector: string;
    argument: { partnerInput: { testResult: null; receipt: Record<string, string> } };
  };
  if (frozen.contractSourceSha256 !== SOURCE_SHA || frozen.argument.partnerInput.testResult !== null || frozen.outerSelector !== "0x27241a99") {
    return Response.json({ ok: false, error: "frozen case does not match the five-argument primary path" }, { status: 409 });
  }
  const { argument, ...summary } = frozen;
  return Response.json({
    ok: true,
    summary,
    receipt: argument.partnerInput.receipt,
    testResult: null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { address?: string };
  const address = body.address ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ ok: false, error: "需要已部署合约的 0x 地址。部署哈希还没回来之前不要提交。" }, { status: 400 });
  }
  const frozen = JSON.parse(readFileSync("fixtures/public/case-submit.json", "utf8")) as {
    innerTxDataSha256: string;
    outerSelector: string;
    argument: unknown;
  };
  if (frozen.outerSelector !== "0x27241a99") {
    return Response.json({ ok: false, error: "冻结案件不是五参主路径。没有发送。" }, { status: 409 });
  }
  const encoded = encode(address as `0x${string}`, frozen.argument, frozen.innerTxDataSha256);
  return Response.json(encoded, { status: encoded.ok ? 200 : 422 });
}
