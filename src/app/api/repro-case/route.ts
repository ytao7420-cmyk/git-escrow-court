import { encodeReproTransaction, buildReproArgument } from "@/lib/repro-case";
import { primaryAddTransaction } from "@/lib/official-primary";
import { COURT_ADDRESS, HISTORICAL_CASE_ID, REPRO_CASE_ID } from "@/lib/repro-shared";

export const runtime = "nodejs";

export async function GET() {
  const { to } = primaryAddTransaction();
  const argument = buildReproArgument();
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
  const body = (await request.json().catch(() => ({}))) as { sender?: string; broadcast?: boolean; send?: boolean };
  if (body.broadcast === true || body.send === true) {
    return Response.json({ ok: false, error: "这个接口不发送交易。" }, { status: 405 });
  }
  try {
    const encoded = encodeReproTransaction(body.sender ?? "");
    return Response.json(
      encoded.ok ? { ...encoded, caseId: REPRO_CASE_ID, llm: false } : encoded,
      { status: encoded.ok ? 200 : 422 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "encode failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
