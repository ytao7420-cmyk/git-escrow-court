import { formatProviderError, hexQuantity, isTxHash } from "@/lib/wallet-transport";
import type { GenLayerLookup } from "@/lib/genlayer-tx";

import { COURT_ADDRESS, FEE_CAP_WEI, REPRO_CASE_ID } from "@/lib/repro-shared";

export type ReproEncode =
  | {
      ok: true;
      to: string;
      recipient: string;
      data: string;
      caseId: string;
      method: string;
      value: "0x0";
    }
  | { ok: false; error: string };

export type ReproReadback =
  | {
      ok: true;
      record: {
        caseId?: string;
        decision?: string;
        mandateStatus?: string;
        violations?: string[];
        reasoningSource?: string;
      };
    }
  | { ok: false; error: string };

export type ReproPhase = "ready" | "awaiting-wallet" | "submitted" | "pending" | "finalized" | "read-back" | "error";

export type ReproResult = {
  phase: ReproPhase;
  sent: boolean;
  hash: string | null;
  allowAnotherSend: boolean;
  lines: string[];
  decision: string | null;
};

type RequestArgs = { method: string; params?: unknown[] };

const CHAIN = new Set(["0xf22f", "61999", "0xF22F"]);

function line(result: ReproResult, text: string, patch: Partial<ReproResult> = {}): ReproResult {
  return { ...result, ...patch, lines: [...result.lines, text] };
}

function stop(result: ReproResult, text: string, allowAnotherSend = true): ReproResult {
  return line(result, text, { phase: "error", allowAnotherSend, sent: result.sent });
}

function asciiHex(text: string): string {
  return [...text].map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
}

export async function runReproLifecycle(input: {
  userConfirmed: boolean;
  expectedConsensus: string;
  request: (args: RequestArgs) => Promise<unknown>;
  encode: (sender: string) => Promise<ReproEncode>;
  lookup: (hash: string) => Promise<GenLayerLookup>;
  readback: (caseId: string) => Promise<ReproReadback>;
  maxPolls?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ReproResult> {
  let result: ReproResult = {
    phase: "ready",
    sent: false,
    hash: null,
    allowAnotherSend: true,
    lines: [],
    decision: null,
  };
  if (!input.userConfirmed) {
    return stop(result, "还没有用户点击。没有连接钱包，也没有发送。");
  }

  const chainId = await input.request({ method: "eth_chainId" });
  const chain = typeof chainId === "string" || typeof chainId === "number" ? String(chainId) : "";
  if (!CHAIN.has(chain)) {
    return stop(result, `当前链是 ${chain || "空"}，不是 Studionet 61999。没有连接后的发送。`);
  }

  const accounts = await input.request({ method: "eth_requestAccounts" });
  const sender = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(sender)) {
    return stop(result, "钱包没有返回账户。没有发送。");
  }

  const encoded = await input.encode(sender);
  if (!encoded.ok) return stop(result, encoded.error);
  const caseId = String(encoded.caseId);
  if (caseId !== REPRO_CASE_ID) {
    return stop(result, "编码结果不是新的复现案件。没有发送。");
  }
  if (encoded.method !== "review_case") return stop(result, "编码方法不是 review_case。没有发送。");
  if (encoded.recipient.toLowerCase() !== COURT_ADDRESS.toLowerCase()) {
    return stop(result, "这笔交易不是调用已部署合约。没有发送。");
  }
  if (encoded.to.toLowerCase() !== input.expectedConsensus.toLowerCase()) {
    return stop(result, "外层目标不是官方共识合约。没有发送。");
  }
  if (encoded.value !== "0x0" || !encoded.data.toLowerCase().startsWith("0x27241a99")) {
    return stop(result, "value 或 selector 不符合五参主路径。没有发送。");
  }
  const body = encoded.data.slice(2).toLowerCase();
  if (body.includes(asciiHex("review_case_with_model")) || !body.includes(asciiHex("review_case"))) {
    return stop(result, "calldata 不是确定性 review_case。没有发送。");
  }

  let gas: unknown;
  let gasPrice: unknown;
  let nonce: unknown;
  try {
    gas = await input.request({
      method: "eth_estimateGas",
      params: [{ from: sender, to: encoded.to, data: encoded.data, value: "0x0" }],
    });
    gasPrice = await input.request({ method: "eth_gasPrice" });
    nonce = await input.request({ method: "eth_getTransactionCount", params: [sender, "pending"] });
  } catch (error) {
    return stop(result, `${formatProviderError(error)}。费用还没核对，没有发送。`);
  }
  const gasHex = hexQuantity(gas, "gas");
  const priceHex = hexQuantity(gasPrice, "gasPrice");
  const nonceHex = hexQuantity(nonce, "nonce");
  if (!gasHex.ok) return stop(result, gasHex.error);
  if (!priceHex.ok) return stop(result, priceHex.error);
  if (!nonceHex.ok) return stop(result, nonceHex.error);
  const feeWei = BigInt(gasHex.hex) * BigInt(priceHex.hex);
  if (feeWei > FEE_CAP_WEI) {
    return stop(result, `估算费用 ${feeWei.toString()} wei 超过 0.001 测试 GEN。没有发送。`);
  }

  result = line(result, "用户已点击。正在等待钱包确认这笔新测试案件。", {
    phase: "awaiting-wallet",
    allowAnotherSend: false,
  });
  let sentHash: unknown;
  try {
    sentHash = await input.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: sender,
          to: encoded.to,
          data: encoded.data,
          value: "0x0",
          gas: gasHex.hex,
          gasPrice: priceHex.hex,
          nonce: nonceHex.hex,
          type: "0x0",
          chainId: "0xf22f",
        },
      ],
    });
    result = { ...result, sent: true };
  } catch (error) {
    const detail = formatProviderError(error);
    const rejected = detail.includes("code 4001");
    return line(result, `${detail}。${rejected ? "用户拒绝了钱包确认，没有交易哈希。" : "钱包没有返回哈希。不要把它当成已写入。"}`, {
      phase: "error",
      sent: true,
      allowAnotherSend: rejected,
    });
  }
  if (!isTxHash(sentHash)) {
    return line(result, "钱包返回的不是交易哈希。状态未知，发送保持关闭。", {
      phase: "error",
      sent: true,
      allowAnotherSend: false,
    });
  }
  result = line(result, `钱包返回哈希 ${sentHash}。这只是提交，还不是判断。`, {
    phase: "submitted",
    sent: true,
    hash: sentHash,
    allowAnotherSend: false,
  });

  const polls = input.maxPolls ?? 8;
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const intervalMs = input.intervalMs ?? 3_000;
  let lookup: GenLayerLookup | null = null;
  for (let attempt = 0; attempt < polls; attempt += 1) {
    if (attempt > 0) await sleep(intervalMs);
    try {
      lookup = await input.lookup(sentHash);
    } catch (error) {
      return line(result, `${formatProviderError(error)}。查询失败。没有再次发送。`, {
        phase: "pending",
        allowAnotherSend: false,
      });
    }
    if (lookup.found && lookup.status === "FINALIZED") break;
  }
  if (!lookup?.found || lookup.status !== "FINALIZED") {
    return line(result, "交易还没有 FINALIZED。不要再发送，用只读查询看这个哈希。", {
      phase: "pending",
      allowAnotherSend: false,
    });
  }
  const execution = lookup.executionResults;
  if (execution.length === 0 || execution.some((item) => item !== "SUCCESS")) {
    return line(result, "交易已 FINALIZED，但 execution_result 不是 SUCCESS。没有把执行失败写成判断，也没有再发送。", {
      phase: "error",
      allowAnotherSend: false,
    });
  }
  result = line(result, `状态 ${lookup.status} / ${lookup.resultName ?? "无"}，execution_result ${execution.join("/")}。执行成功还不是判断。`, {
    phase: "finalized",
  });

  const read = await input.readback(REPRO_CASE_ID);
  if (!read.ok) {
    return line(result, `${read.error}。get_record 没有读到。没有把执行成功写成判断。`, {
      phase: "error",
      allowAnotherSend: false,
    });
  }
  const record = read.record;
  const violations = record.violations ?? [];
  if (
    record.caseId !== REPRO_CASE_ID ||
    record.decision !== "escalate" ||
    record.mandateStatus !== "escalated" ||
    record.reasoningSource !== "deterministic-rubric" ||
    !violations.includes("missing-test-result") ||
    violations.includes("freeze-hash-mismatch")
  ) {
    return line(
      result,
      `读回是 decision ${record.decision ?? "无"} / ${record.reasoningSource ?? "无"} / ${(violations.join(",") || "无")}。这不是这笔缺日志复现的预期，不能写成测试通过。`,
      { phase: "error", decision: record.decision ?? null, allowAnotherSend: false },
    );
  }
  return line(
    result,
    `get_record ${record.caseId} decision escalate，mandateStatus escalated，missing-test-result，reasoningSource deterministic-rubric。缺日志不是测试通过，也不是 LLM 判决。`,
    { phase: "read-back", decision: "escalate", allowAnotherSend: false },
  );
}
