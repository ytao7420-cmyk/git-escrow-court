import { spawn } from "node:child_process";

export const runtime = "nodejs";

const scenarios = new Set([
  "pass",
  "warn",
  "constrain",
  "revoke",
  "escalate",
  "rename",
  "preset",
  "tamper",
  "live-claim",
  "repeat",
  "public-fulfillment",
]);

function review(scenario: string, uid?: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const child = spawn("python3", ["scripts/review_case.py"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", () => {
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch {
        resolve({ ok: false, mode: "local-direct-vm", error: stderr || stdout || "review process failed" });
      }
    });
    child.stdin.write(JSON.stringify({ scenario, uid }));
    child.stdin.end();
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { scenario?: string; uid?: string };
  const scenario = body.scenario ?? "";
  const uid = typeof body.uid === "string" ? body.uid : undefined;
  if (!scenarios.has(scenario)) {
    return Response.json({ ok: false, error: "unknown scenario" }, { status: 400 });
  }
  if (scenario === "public-fulfillment" && !uid) {
    return Response.json({ ok: false, error: "public fulfillment needs an attestation uid" }, { status: 400 });
  }
  const result = await review(scenario, uid);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
