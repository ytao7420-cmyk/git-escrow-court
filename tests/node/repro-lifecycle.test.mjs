process.env.REPRO_ENCODE_PUBLIC = "1";

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { GET, POST } from "../../src/app/api/repro-case/route.ts";
import { buildReproArgument, encodeReproTransaction } from "../../src/lib/repro-case.ts";
import { runReproLifecycle } from "../../src/lib/repro-lifecycle.ts";
import { createReproCaseId, loadReproGuard, reproClickAllowed, saveReproGuard } from "../../src/lib/repro-shared.ts";

const SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";
const HASH = `0x${"ab".repeat(32)}`;
const SOURCE_SHA = "4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e";
const CONSENSUS = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575";
const CASE_A = createReproCaseId(new Uint8Array(16).fill(1));
const CASE_B = createReproCaseId(new Uint8Array(16).fill(2));

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

function lookup(hash, status, executionResults) {
  return {
    ok: true,
    found: true,
    hash,
    status,
    resultName: status === "FINALIZED" ? "MAJORITY_AGREE" : null,
    resultCode: null,
    executionResults,
    contractAddress: "0x37383a73306B8F31d9158C3419C29EED856cc1Bc",
    from: SENDER,
    to: CONSENSUS,
    value: "0x0",
    evmStatus: null,
    genvmError: null,
    note: "mock",
  };
}

function wallet(overrides = {}) {
  const methods = [];
  const sent = [];
  const request = async ({ method, params }) => {
    methods.push(method);
    if (method === "eth_sendTransaction") sent.push(params?.[0]);
    if (overrides[method]) return overrides[method](params);
    if (method === "eth_chainId") return "0xf22f";
    if (method === "eth_requestAccounts") return [SENDER];
    if (method === "eth_estimateGas") return "0x5208";
    if (method === "eth_gasPrice") return "0x0";
    if (method === "eth_getTransactionCount") return "0x3";
    if (method === "eth_sendTransaction") return HASH;
    throw new Error(`unexpected ${method}`);
  };
  return { methods, sent, request };
}

function openCase() {
  return async () => ({ ok: true, exists: false });
}

function run(session, extra) {
  return runReproLifecycle({
    userConfirmed: true,
    caseId: CASE_A,
    expectedConsensus: CONSENSUS,
    request: session.request,
    encode: async (sender) => encodeReproTransaction(sender, CASE_A),
    probe: openCase(),
    lookup: async (hash) => lookup(hash, "FINALIZED", ["SUCCESS", "SUCCESS"]),
    readback: async (caseId) => ({
      ok: true,
      record: {
        caseId,
        decision: "escalate",
        mandateStatus: "escalated",
        violations: ["missing-test-result"],
        reasoningSource: "deterministic-rubric",
      },
    }),
    maxPolls: 1,
    intervalMs: 0,
    sleep: async () => {},
    ...extra,
  });
}

test("each reproduction gets its own case id and the freeze matches the contract", () => {
  assert.notEqual(CASE_A, CASE_B);
  assert.equal(CASE_A.startsWith("repro-"), true);
  assert.equal(createReproCaseId(new Uint8Array(16).fill(1)), CASE_A);
  const argument = buildReproArgument(CASE_A);
  assert.equal(argument.caseId, CASE_A);
  assert.equal(argument.partnerInput.receipt.caseId, CASE_A);
  assert.equal(argument.partnerInput.testResult, null);
  assert.equal(Object.hasOwn(argument, "decision"), false);
  assert.throws(() => buildReproArgument("repro-missing-log-v1"));
  assert.throws(() => buildReproArgument("public-0726369d528e"));
  const python = spawnSync(
    "python3",
    ["-c", "import json,sys; from court.canonical import freeze_for; print(json.dumps(freeze_for(json.loads(sys.stdin.read()))))"],
    { input: JSON.stringify(argument), encoding: "utf8" },
  );
  assert.equal(python.status, 0, python.stderr);
  const freeze = JSON.parse(python.stdout);
  assert.equal(argument.freeze.mandateHash, freeze.mandateHash);
  assert.equal(argument.freeze.rubricHash, freeze.rubricHash);
  assert.equal(argument.freeze.evidenceHash, freeze.evidenceHash);
});

test("official SDK encoding is value 0, chain-specific, and not a deploy", () => {
  const first = encodeReproTransaction(SENDER, CASE_A);
  const second = encodeReproTransaction(SENDER, CASE_B);
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.value, "0x0");
  assert.equal(first.selector, "0x27241a99");
  assert.equal(first.recipient, "0x37383a73306B8F31d9158C3419C29EED856cc1Bc");
  assert.equal(first.to, CONSENSUS);
  assert.notEqual(first.data, second.data);
  assert.equal(first.data.includes("e71d5196"), false);
  assert.equal(first.data.toLowerCase().includes(Buffer.from(CASE_A).toString("hex")), true);
  assert.equal(encodeReproTransaction(SENDER, "public-0726369d528e").ok, false);
});

test("loading and a missing click do not request the wallet", async () => {
  let called = false;
  const result = await runReproLifecycle({
    userConfirmed: false,
    caseId: CASE_A,
    expectedConsensus: CONSENSUS,
    request: async () => {
      called = true;
      throw new Error("wallet");
    },
    encode: async () => {
      throw new Error("encode");
    },
    probe: async () => {
      throw new Error("probe");
    },
    lookup: async () => {
      throw new Error("lookup");
    },
    readback: async () => {
      throw new Error("readback");
    },
  });
  assert.equal(called, false);
  assert.equal(result.sent, false);
});

test("wrong chain, high fee, an existing case, and a different id stop before send", async () => {
  const wrong = wallet({ eth_chainId: async () => "0x1" });
  const wrongResult = await run(wrong, {});
  assert.deepEqual(wrong.methods, ["eth_chainId"]);
  assert.equal(wrongResult.sent, false);

  const expensive = wallet({
    eth_estimateGas: async () => "0x100000",
    eth_gasPrice: async () => "0x100000000000",
  });
  let marked = 0;
  const expensiveResult = await run(expensive, { onBeforeSend: () => { marked += 1; } });
  assert.equal(expensive.sent.length, 0);
  assert.equal(marked, 0);
  assert.match(expensiveResult.lines.at(-1) ?? "", /0\.001/);

  const present = wallet();
  const presentResult = await run(present, { probe: async () => ({ ok: true, exists: true }) });
  assert.equal(present.methods.includes("eth_sendTransaction"), false);
  assert.equal(presentResult.allowAnotherSend, false);

  const unread = wallet();
  const unreadResult = await run(unread, { probe: async () => ({ ok: false, error: "list_cases 没有读到" }) });
  assert.equal(unread.methods.includes("eth_sendTransaction"), false);
  assert.match(unreadResult.lines.at(-1) ?? "", /没有发送/);

  const swapped = wallet();
  const swappedResult = await run(swapped, {
    encode: async () => encodeReproTransaction(SENDER, CASE_B),
  });
  assert.equal(swapped.methods.includes("eth_sendTransaction"), false);
  assert.match(swappedResult.lines.at(-1) ?? "", /不是这次保存的案件/);
});

test("mocked send uses the fee-checked transaction and reads the judgment only after success", async () => {
  const session = wallet();
  let polls = 0;
  let reads = 0;
  let marked = 0;
  const result = await run(session, {
    onBeforeSend: () => { marked += 1; },
    lookup: async (hash) => {
      polls += 1;
      return lookup(hash, polls === 1 ? "PENDING" : "FINALIZED", polls === 1 ? [] : ["SUCCESS", "SUCCESS"]);
    },
    readback: async (caseId) => {
      reads += 1;
      assert.equal(caseId, CASE_A);
      return {
        ok: true,
        record: {
          caseId,
          decision: "escalate",
          mandateStatus: "escalated",
          violations: ["missing-test-result"],
          reasoningSource: "deterministic-rubric",
        },
      };
    },
    maxPolls: 2,
  });
  assert.equal(session.sent.length, 1);
  assert.equal(session.sent[0].value, "0x0");
  assert.equal(session.sent[0].chainId, "0xf22f");
  assert.equal(session.sent[0].gas, "0x5208");
  assert.equal(session.sent[0].gasPrice, "0x0");
  assert.equal(session.sent[0].data.startsWith("0x27241a99"), true);
  assert.equal(marked, 1);
  assert.equal(polls, 2);
  assert.equal(reads, 1);
  assert.equal(result.phase, "read-back");
  assert.equal(result.decision, "escalate");
  assert.equal(result.allowAnotherSend, false);
});

test("rejection can be retried with the same id, and failure is not a passed test", async () => {
  const seen = [];
  const rejected = wallet({
    eth_sendTransaction: async () => {
      throw { code: 4001, message: "User rejected" };
    },
  });
  const rejectedResult = await run(rejected, {
    encode: async (sender) => {
      seen.push(CASE_A);
      return encodeReproTransaction(sender, CASE_A);
    },
  });
  assert.equal(rejectedResult.allowAnotherSend, true);
  assert.equal(rejectedResult.hash, null);

  const again = wallet();
  const againResult = await run(again, {
    encode: async (sender) => {
      seen.push(CASE_A);
      return encodeReproTransaction(sender, CASE_A);
    },
  });
  assert.equal(seen.length, 2);
  assert.equal(again.sent.length, 1);
  assert.equal(againResult.phase, "read-back");

  const failed = wallet();
  let failedReads = 0;
  const failedResult = await run(failed, {
    lookup: async (hash) => lookup(hash, "FINALIZED", ["ERROR"]),
    readback: async () => {
      failedReads += 1;
      throw new Error("readback");
    },
  });
  assert.equal(failedReads, 0);
  assert.equal(failedResult.decision, null);
  assert.equal(failedResult.phase, "error");

  const wrong = wallet();
  const wrongResult = await run(wrong, {
    readback: async (caseId) => ({
      ok: true,
      record: { caseId, decision: "continue", mandateStatus: "active", violations: [], reasoningSource: "model-agreed-with-rubric" },
    }),
  });
  assert.equal(wrongResult.phase, "error");
  assert.match(wrongResult.lines.at(-1) ?? "", /不能写成测试通过/);
});

test("a stored hash stays locked on the same id, and the encode route does not call the network", async () => {
  const storage = memoryStorage();
  saveReproGuard(storage, { caseId: CASE_A, hash: HASH, locked: true, lines: ["already"] });
  const restored = loadReproGuard(storage);
  assert.equal(restored.caseId, CASE_A);
  assert.equal(restored.hash, HASH);
  assert.equal(reproClickAllowed(restored), false);
  saveReproGuard(storage, { caseId: CASE_A, hash: null, locked: true, lines: ["wallet requested"] });
  assert.equal(reproClickAllowed(loadReproGuard(storage)), false);
  assert.equal(loadReproGuard(storage).caseId, CASE_A);

  const original = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => {
    fetches += 1;
    throw new Error("network");
  };
  try {
    const described = await GET(new Request(`http://127.0.0.1/api/repro-case?caseId=${CASE_A}`));
    const body = await described.json();
    assert.equal(body.broadcast, false);
    assert.equal(body.caseId, CASE_A);
    assert.equal(body.argument.partnerInput.testResult, null);
    const missing = await GET(new Request("http://127.0.0.1/api/repro-case"));
    assert.equal(missing.status, 400);
    const oldId = await POST(new Request("http://127.0.0.1/api/repro-case", {
      method: "POST",
      body: JSON.stringify({ sender: SENDER, caseId: "repro-missing-log-v1", broadcast: false }),
    }));
    assert.equal(oldId.status, 400);
    const refused = await POST(new Request("http://127.0.0.1/api/repro-case", {
      method: "POST",
      body: JSON.stringify({ sender: SENDER, caseId: CASE_A, broadcast: true }),
    }));
    assert.equal(refused.status, 405);
    const encoded = await POST(new Request("http://127.0.0.1/api/repro-case", {
      method: "POST",
      body: JSON.stringify({ sender: SENDER, caseId: CASE_A, broadcast: false }),
    }));
    const payload = await encoded.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.caseId, CASE_A);
    assert.equal(payload.value, "0x0");
    assert.equal(payload.signed, false);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(fetches, 0);

  const page = readFileSync("src/app/repro/page.tsx", "utf8");
  const panel = readFileSync("src/components/wallet-panel.tsx", "utf8");
  const submit = readFileSync("src/components/case-submit.tsx", "utf8");
  const component = readFileSync("src/components/repro-case.tsx", "utf8");
  const effect = component.slice(component.indexOf("useEffect"), component.indexOf("async function confirm"));
  assert.equal(page.includes("eth_sendTransaction"), false);
  assert.equal(effect.includes("eth_requestAccounts"), false);
  assert.equal(effect.includes("eth_sendTransaction"), false);
  assert.equal(panel.includes("已部署，禁止再次部署"), true);
  assert.equal(submit.includes("已写入，禁止再次提交"), true);
  assert.equal(createHash("sha256").update(readFileSync("contracts/git_escrow_court.py")).digest("hex"), SOURCE_SHA);
});
