import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { deployRefusal, type DeployPayload } from "@/lib/deploy-check";

export const runtime = "nodejs";

export async function GET() {
  try {
    const source = readFileSync("contracts/git_escrow_court.py");
    const sourceSha256 = createHash("sha256").update(source).digest("hex");
    const payload = JSON.parse(readFileSync("fixtures/public/unsigned-deploy.json", "utf8")) as DeployPayload;
    if (payload.sourceSha256 !== sourceSha256) {
      return Response.json(
        {
          ok: false,
          error: "unsigned payload does not match the current contract source",
          sourceSha256,
          payloadSha256: payload.sourceSha256,
        },
        { status: 409 },
      );
    }
    const refusal = deployRefusal(payload);
    if (refusal) return Response.json({ ok: false, error: refusal }, { status: 409 });
    return Response.json({ ok: true, payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payload read failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
