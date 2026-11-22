import { encodePublicEnabled, withEncodeSlot } from "@/lib/encode-gate";
import { readLimitedJson } from "@/lib/limited-json";
import { encodeReproTransaction, buildReproArgument } from "@/lib/repro-case";
import { primaryAddTransaction } from "@/lib/official-primary";
import { COURT_ADDRESS, HISTORICAL_CASE_ID, isReproCaseId } from "@/lib/repro-shared";

export const runtime = "nodejs";

function caseIdFrom(value: string | null): string | null {
  return value && isReproCaseId(value) ? value : null;
}

export async function GET(request: Request) {
  const caseId = caseIdFrom(new URL(request.url).searchParams.get("caseId"));
  if (!caseId) {
    return Response.json({ ok: false, error: "需要本次复现保存的唯一 caseId。没有发送。" }, { status: 400 });
  }
  const { to } = primaryAddTransaction();
  const argument = buildReproArgument(caseId);
  return Response.json({
    ok: true,
    broadcast: false,
    signed: false,
    method: "review_case",
    llm: false,
    chainId: 61999,
    value: "0x0",
    contract: COURT_ADDRESS,
    consensus: to,
    caseId: argument.caseId,
    historicalCaseId: HISTORICAL_CASE_ID,
    expectedDecision: "escalate",
    expectedViolation: "missing-test-result",
    reasoningSource: "deterministic-rubric",
    argument,
    note: "Unsigned reproduction description. This response does not send a transaction.",
  });
}

export async function POST(request: Request) {
  const limited = await readLimitedJson(request);
  if (!limited.ok) return Response.json({ ok: false, error: limited.error }, { status: limited.status });
  if (!encodePublicEnabled()) {
    return Response.json(
      { ok: false, error: "公开编码默认关闭。只读页面不受影响。", encodeEnabled: false },
      { status: 403 },
    );
  }
  const record = limited.value !== null && typeof limited.value === "object" && !Array.isArray(limited.value)
    ? limited.value as { sender?: string; caseId?: string; broadcast?: boolean; send?: boolean }
    : {};
  const body = record;
  if (body.broadcast === true || body.send === true) {
    return Response.json({ ok: false, error: "这个接口不发送交易。" }, { status: 405 });
  }
  const caseId = caseIdFrom(body.caseId ?? null);
  if (!caseId) {
    return Response.json({ ok: false, error: "需要本次复现保存的唯一 caseId。没有发送。" }, { status: 400 });
  }
  try {
    const slot = await withEncodeSlot(async () => encodeReproTransaction(body.sender ?? "", caseId));
    if (!slot.ok) return Response.json({ ok: false, error: slot.error }, { status: slot.status });
    const encoded = slot.value;
    return Response.json(encoded.ok ? { ...encoded, llm: false } : encoded, { status: encoded.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "encode failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
