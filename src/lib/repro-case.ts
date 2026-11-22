import { createHash } from "node:crypto";

import {
  FALLBACK_SELECTOR,
  PRIMARY_SELECTOR,
  ZERO,
  canonicalJson,
  encodePrimary,
  encodeReviewInner,
  primaryAddTransaction,
} from "@/lib/official-primary";

import { COURT_ADDRESS, REPRO_CASE_ID, SCHEMA_TEXT } from "@/lib/repro-shared";

export type ReproArgument = {
  caseId: string;
  execution: {
    mode: string;
    hostedCourtCase: false;
    publicTestnetReceipt: false;
    createdByThisProject: false;
  };
  mandate: {
    id: string;
    objective: string;
    authoritySummary: string;
    prohibitedActions: string[];
  };
  rubric: string[];
  partnerInput: {
    partner: "arkhai";
    interface: "git-escrows";
    receipt: Record<string, string>;
    testResult: null;
  };
  freeze: {
    algorithm: "sha256";
    mandateHash: string;
    rubricHash: string;
    evidenceHash: string;
  };
};

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function draftBody(): Omit<ReproArgument, "freeze"> {
  return {
    caseId: REPRO_CASE_ID,
    execution: {
      mode: "studionet-repro",
      hostedCourtCase: false,
      publicTestnetReceipt: false,
      createdByThisProject: false,
    },
    mandate: {
      id: "mandate-repro-missing-log-v1",
      objective: "Show one new Studionet review_case write for a receipt that has no test log.",
      authoritySummary: "Do not deploy, do not repeat public-0726369d528e, and do not invent a passing test log.",
      prohibitedActions: [
        "deploy another contract",
        "submit public-0726369d528e again",
        "call the nondeterministic model method",
        "claim an Internet Court hosted case id",
        "treat a missing test log as a passed test",
      ],
    },
    rubric: [
      "method: review_case only",
      "result: a null testResult is escalate and missing-test-result",
      "limit: this reproduction does not move tokens",
    ],
    partnerInput: {
      partner: "arkhai",
      interface: "git-escrows",
      receipt: {
        caseId: REPRO_CASE_ID,
        source: "lifecycle-repro",
        network: "studionet",
        "tests-repo": "file://fixtures/repro/missing-log",
        "tests-commit": "repro-missing-log-no-suite",
        "solution-repo": "file://fixtures/repro/missing-log",
        "solution-commit": "repro-missing-log-no-solution",
        "escrow-uid": "repro-not-an-escrow",
        "fulfillment-uid": "repro-not-a-fulfillment",
        reward: "0",
        token: "test-gen-no-transfer",
        oracle: "not-an-oracle",
        arbiter: "not-an-arbiter",
        schema: SCHEMA_TEXT,
      },
      testResult: null,
    },
  };
}

export function buildReproArgument(): ReproArgument {
  const draft = draftBody();
  const evidence = { receipt: draft.partnerInput.receipt, testResult: draft.partnerInput.testResult };
  return {
    ...draft,
    freeze: {
      algorithm: "sha256",
      mandateHash: sha256(canonicalJson(draft.mandate)),
      rubricHash: sha256(canonicalJson(draft.rubric)),
      evidenceHash: sha256(canonicalJson(evidence)),
    },
  };
}

function collectKeys(value: unknown, keys: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    keys.push(key);
    collectKeys(item, keys);
  }
}

export function assertReproSafe(argument: ReproArgument): { ok: true } | { ok: false; error: string } {
  const caseId = String(argument.caseId);
  if (caseId !== REPRO_CASE_ID) return { ok: false, error: "新案件 id 不是 repro-missing-log-v1。没有发送。" };
  if (argument.execution.hostedCourtCase !== false || argument.execution.publicTestnetReceipt !== false) {
    return { ok: false, error: "复现案件不能声称托管案号或已有测试网回执。没有发送。" };
  }
  const keys: string[] = [];
  collectKeys(argument, keys);
  if (keys.some((key) => key === "decision" || key === "courtDecision" || key === "verdict")) {
    return { ok: false, error: "调用方不能预填判断。没有发送。" };
  }
  if (keys.some((key) => key === "releaseDiff" || key === "release-diff" || key === "release_diff")) {
    return { ok: false, error: "release-diff 不是 git-escrow 字段。没有发送。" };
  }
  const partner = argument.partnerInput;
  if (partner.partner !== "arkhai" || partner.interface !== "git-escrows" || partner.testResult !== null) {
    return { ok: false, error: "复现案件必须是没有测试日志的 arkhai git-escrows 收据。没有发送。" };
  }
  if (partner.receipt.caseId !== argument.caseId || !partner.receipt.schema.includes(SCHEMA_TEXT)) {
    return { ok: false, error: "收据 caseId 或 schema 不符合合约检查。没有发送。" };
  }
  const evidence = { receipt: partner.receipt, testResult: partner.testResult };
  const mandateHash = sha256(canonicalJson(argument.mandate));
  const rubricHash = sha256(canonicalJson(argument.rubric));
  const evidenceHash = sha256(canonicalJson(evidence));
  if (
    argument.freeze.mandateHash !== mandateHash ||
    argument.freeze.rubricHash !== rubricHash ||
    argument.freeze.evidenceHash !== evidenceHash
  ) {
    return { ok: false, error: "冻结哈希和合约算法不一致。没有发送。" };
  }
  return { ok: true };
}

export function encodeReproTransaction(sender: string):
  | {
      ok: true;
      broadcast: false;
      signed: false;
      method: "review_case";
      caseId: typeof REPRO_CASE_ID;
      to: `0x${string}`;
      recipient: typeof COURT_ADDRESS;
      data: `0x${string}`;
      selector: typeof PRIMARY_SELECTOR;
      value: "0x0";
    }
  | { ok: false; error: string } {
  if (!/^0x[0-9a-fA-F]{40}$/.test(sender) || sender.toLowerCase() === ZERO) {
    return { ok: false, error: "发送账户不是可用地址。没有发送。" };
  }
  const argument = buildReproArgument();
  const safe = assertReproSafe(argument);
  if (!safe.ok) return safe;
  const { to } = primaryAddTransaction();
  if (to.toLowerCase() === COURT_ADDRESS.toLowerCase() || to.toLowerCase() === ZERO) {
    return { ok: false, error: "外层交易必须送到共识合约，而不是再部署。没有发送。" };
  }
  const data = encodePrimary(COURT_ADDRESS, encodeReviewInner(canonicalJson(argument)), sender as `0x${string}`);
  if (!data.startsWith(PRIMARY_SELECTOR)) return { ok: false, error: "selector 不是五参主路径。没有发送。" };
  if (data.toLowerCase().includes(FALLBACK_SELECTOR.slice(2).toLowerCase())) {
    return { ok: false, error: "calldata 含有六参 selector。没有发送。" };
  }
  const encoded = data.slice(2).toLowerCase();
  const model = Buffer.from("review_case_with_model").toString("hex");
  const method = Buffer.from("review_case").toString("hex");
  if (encoded.includes(model) || !encoded.includes(method)) {
    return { ok: false, error: "内层方法不是 review_case。没有发送。" };
  }
  if (!encoded.includes(COURT_ADDRESS.slice(2).toLowerCase())) {
    return { ok: false, error: "calldata 没有指向已部署合约。没有发送。" };
  }
  return {
    ok: true,
    broadcast: false,
    signed: false,
    method: "review_case",
    caseId: REPRO_CASE_ID,
    to,
    recipient: COURT_ADDRESS,
    data,
    selector: PRIMARY_SELECTOR,
    value: "0x0",
  };
}
