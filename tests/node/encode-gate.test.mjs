import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { POST } from "../../src/app/api/repro-case/route.ts";
import { withEncodeSlot } from "../../src/lib/encode-gate.ts";
import { executionSucceeded, REPRO_CASE_TX } from "../../src/lib/public-reads.ts";
import { createReproCaseId } from "../../src/lib/repro-shared.ts";

const SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";
const CASE_ID = createReproCaseId(new Uint8Array(16).fill(9));

function post(body) {
  return POST(new Request("http://127.0.0.1/api/repro-case", { method: "POST", body }));
}

test("public encode stays closed unless it is explicitly enabled", async () => {
  const previous = process.env.REPRO_ENCODE_PUBLIC;
  delete process.env.REPRO_ENCODE_PUBLIC;
  try {
    const response = await post(JSON.stringify({ sender: SENDER, caseId: CASE_ID, broadcast: false }));
    const payload = await response.json();
    assert.equal(response.status, 403);
    assert.equal(payload.encodeEnabled, false);
    assert.equal(Object.hasOwn(payload, "data"), false);
  } finally {
    if (previous === undefined) delete process.env.REPRO_ENCODE_PUBLIC;
    else process.env.REPRO_ENCODE_PUBLIC = previous;
  }
});

test("a huge body is rejected before encoding even while public encode is closed", async () => {
  const previous = process.env.REPRO_ENCODE_PUBLIC;
  delete process.env.REPRO_ENCODE_PUBLIC;
  try {
    const response = await post(`{"pad":"${"a".repeat(40_000)}"}`);
    assert.equal(response.status, 413);
  } finally {
    if (previous === undefined) delete process.env.REPRO_ENCODE_PUBLIC;
    else process.env.REPRO_ENCODE_PUBLIC = previous;
  }
});

test("the in-process encode slot rejects the third overlap and then accepts again", async () => {
  let release = () => {};
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  const first = withEncodeSlot(() => hold);
  const second = withEncodeSlot(() => hold);
  const third = await withEncodeSlot(async () => "no");
  assert.equal(third.ok, false);
  if (!third.ok) assert.equal(third.status, 429);
  release();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
  const fourth = await withEncodeSlot(async () => "yes");
  assert.equal(fourth.ok, true);
});

test("execution success requires every result, and the new case hash is a frozen identifier", () => {
  assert.equal(executionSucceeded(["SUCCESS", "SUCCESS"]), true);
  assert.equal(executionSucceeded(["SUCCESS", "ERROR"]), false);
  assert.equal(executionSucceeded([]), false);
  assert.equal(REPRO_CASE_TX, "0xd72bc727c5a0c16bef3326d0f4a18593b22774f4d5f79553447d4bc6aefeea68");
  const page = readFileSync("src/components/case-submit.tsx", "utf8");
  const receipts = readFileSync("src/components/public-receipts.tsx", "utf8");
  const chain = readFileSync("src/app/api/chain-record/route.ts", "utf8");
  assert.equal(page.includes('fetch("/api/case-call"'), false);
  assert.equal(receipts.includes('fetch("/api/review"'), false);
  assert.equal(chain.includes("FROZEN_CASE_TXS"), true);
  assert.equal(readFileSync("src/lib/public-reads.ts", "utf8").includes(REPRO_CASE_TX), true);
});
