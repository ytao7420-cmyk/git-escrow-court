import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

test("unsigned deploy payload matches the contract and stays on Studionet at value 0", () => {
  const source = readFileSync("contracts/git_escrow_court.py");
  const payload = JSON.parse(readFileSync("fixtures/public/unsigned-deploy.json", "utf8"));
  assert.equal(payload.sourceSha256, createHash("sha256").update(source).digest("hex"));
  assert.equal(payload.chainId, 61999);
  assert.equal(payload.value, "0x0");
  assert.equal(payload.selector, "0x27241a99");
  assert.equal(payload.data.startsWith("0x27241a99"), true);
  assert.equal(payload.sdkVersion, "1.1.8");
  assert.equal(payload.paramTypes, "address,address,uint256,uint256,bytes");
  assert.equal(payload.fallbackUsed, false);
  assert.equal(payload.estimateIsNotAbiEvidence, true);
  assert.equal(payload.signed, false);
  assert.equal(payload.from, "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9");
  assert.equal(payload.feeCapWei, "1000000000000000");
});

test("public fulfillments keep third-party tests repos when the escrow demand decoded", () => {
  const snapshot = JSON.parse(readFileSync("fixtures/public/arkhai-public-read.json", "utf8"));
  assert.equal(snapshot.notCreatedByThisProject, true);
  assert.ok(snapshot.fulfillments.length > 0);
  const linked = snapshot.fulfillments.filter((item) => item.testsRepo && item.testsCommit);
  assert.ok(linked.length > 0);
  for (const item of linked) {
    assert.equal(item.createdByThisProject, false);
    assert.equal(item.hostedCourtCase, false);
    assert.match(item.testsRepo, /^https?:\/\//);
    assert.match(item.hosts[0], /^https?:\/\//);
    assert.notEqual(item.testsRepo, item.hosts[0]);
  }
});
