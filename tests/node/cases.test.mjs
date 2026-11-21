import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const names = ["pass", "warn", "constrain", "revoke", "escalate"];

for (const name of names) {
  test(`recorded ${name} case keeps git-escrow field names`, () => {
    const body = JSON.parse(readFileSync(`fixtures/cases/${name}.json`, "utf8"));
    const receipt = body.partnerInput.receipt;
    assert.equal(body.execution.mode, "local-fixture");
    assert.equal(body.execution.publicTestnetReceipt, false);
    assert.equal(body.execution.hostedCourtCase, false);
    assert.equal(Object.hasOwn(receipt, "tests-repo"), true);
    assert.equal(Object.hasOwn(receipt, "tests-commit"), true);
    assert.equal(Object.hasOwn(receipt, "release-diff"), false);
    assert.equal(body.decision, undefined);
    const result = body.partnerInput.testResult;
    if (name === "escalate") {
      assert.equal(result, null);
      return;
    }
    assert.equal(result.caseId, body.caseId);
    assert.equal(createHash("sha256").update(result.log).digest("hex"), result.logSha256);
    assert.equal(createHash("sha256").update(result.rawLog).digest("hex"), result.rawSha256);
    assert.match(result.rawLog, /adds two integers|not ok|fail|pass|#/i);
  });
}

test("pass and revoke disagree on the real test exit", () => {
  const pass = JSON.parse(readFileSync("fixtures/cases/pass.json", "utf8"));
  const revoke = JSON.parse(readFileSync("fixtures/cases/revoke.json", "utf8"));
  assert.equal(pass.partnerInput.testResult.passed, true);
  assert.equal(pass.partnerInput.testResult.exitCode, 0);
  assert.equal(revoke.partnerInput.testResult.passed, false);
  assert.notEqual(revoke.partnerInput.testResult.exitCode, 0);
  assert.equal(pass.partnerInput.receipt["tests-commit"], revoke.partnerInput.receipt["tests-commit"]);
});
