import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSendParams,
  formatProviderError,
  hexQuantity,
  incidentLock,
  loadSendState,
  markAwaitingSend,
  markExplicitClear,
  markHash,
  markLateNonHash,
  markPreSendStop,
  markProviderFailure,
  markTimeoutAfterSend,
  providerSummary,
  readProviderFacts,
  rememberPending,
  selectMetaMask,
  watchWalletRequest,
} from "../../src/lib/wallet-transport.ts";

const FEE_CAP = 1000000000000000n;
const FROM = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";

test("provider object errors keep code, message, and data", () => {
  const text = formatProviderError({
    code: -32603,
    message: "Internal JSON-RPC error",
    data: { code: -32000, message: "gas price is 0", data: "0x00" },
  });
  assert.match(text, /code -32603（钱包内部错误）/);
  assert.match(text, /Internal JSON-RPC error/);
  assert.match(text, /code -32000（节点拒绝）/);
  assert.match(text, /gas price is 0/);
  assert.match(text, /data 0x00/);
  assert.equal(text.includes("[object Object]"), false);
});

test("a plain object is not stringified into [object Object]", () => {
  const text = formatProviderError({ code: 4001, message: { reason: "user rejected" } });
  assert.match(text, /code 4001（用户拒绝）/);
  assert.match(text, /user rejected/);
  assert.equal(text.includes("[object Object]"), false);
  assert.equal(formatProviderError({}).includes("[object Object]"), false);
});

test("Error message [object Object] still exposes code and data", () => {
  const error = new Error("[object Object]") as Error & { code: number; data: string };
  error.code = -32602;
  error.data = "invalid gasPrice";
  const text = formatProviderError(error);
  assert.match(text, /code -32602（参数无效）/);
  assert.match(text, /data invalid gasPrice/);
  assert.equal(text.includes("[object Object]"), false);
});

test("quantity objects fail with a readable error", () => {
  const parsed = hexQuantity({ result: "0x7a120" }, "gas");
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error.includes("[object Object]"), false);
  assert.deepEqual(hexQuantity("0x7a120", "gas"), { ok: true, hex: "0x7a120" });
});

test("Studionet block with baseFee uses EIP-1559 fields and omits gasPrice", () => {
  const built = buildSendParams({
    from: FROM,
    to: "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575",
    data: "0xe71d5196",
    gas: "0x7a120",
    gasPrice: "0x0",
    baseFeePerGas: "0x0",
    maxPriorityFeePerGas: "0x0",
    feeCapWei: FEE_CAP,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.kind, "eip1559");
  assert.equal(built.feeWei, 0n);
  assert.equal(built.params.gasPrice, undefined);
  assert.equal(built.params.maxFeePerGas, "0x0");
  assert.equal(built.params.maxPriorityFeePerGas, "0x0");
  assert.equal(built.params.type, "0x2");
  assert.equal(built.params.value, "0x0");
  assert.match(built.note, /不传 gasPrice/);
});

test("a block without baseFee stays legacy", () => {
  const built = buildSendParams({
    from: FROM,
    to: "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575",
    data: "0xe71d5196",
    gas: "0x10",
    gasPrice: "0x5",
    baseFeePerGas: null,
    maxPriorityFeePerGas: null,
    feeCapWei: FEE_CAP,
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.kind, "legacy");
  assert.equal(built.params.gasPrice, "0x5");
  assert.equal(built.params.maxFeePerGas, undefined);
});

test("timeout after eth_sendTransaction stays unknown and a late hash is kept", async () => {
  let resolveSend: (value: string) => void = () => {};
  const request = new Promise<string>((resolve) => {
    resolveSend = resolve;
  });
  let late = "";
  let state = markAwaitingSend(incidentLock(), "已调用 eth_sendTransaction。");
  state = { ...state, phase: "awaiting-wallet", invoked: true, allowNewSend: false };
  const watched = watchWalletRequest(request, 20, (event) => {
    if (event.kind === "value") {
      state = markHash(state, String(event.value));
      late = state.hash ?? "";
    }
  });
  const timed = await watched;
  assert.equal(timed.status, "timeout");
  state = markTimeoutAfterSend(state, 60);
  assert.equal(state.phase, "unknown");
  assert.equal(state.allowNewSend, false);
  assert.equal(state.lines.some((line) => line.includes("没有发送交易")), false);
  assert.equal(state.lines.some((line) => line.includes("按钮已恢复")), false);
  assert.match(state.lines.at(-1) ?? "", /状态未知/);
  resolveSend(`0x${"ab".repeat(32)}`);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(late, `0x${"ab".repeat(32)}`);
  assert.equal(state.phase, "hash");
  assert.equal(state.allowNewSend, false);
});

test("a late rejection after timeout does not unlock another send", async () => {
  let rejectSend: (error: unknown) => void = () => {};
  const request = new Promise<string>((_, reject) => {
    rejectSend = reject;
  });
  let state = markAwaitingSend({ ...incidentLock(), phase: "ready", allowNewSend: true }, "已调用。");
  const watched = watchWalletRequest(request, 15, (event) => {
    if (event.kind === "error") state = markProviderFailure(state, event.error, "after-invoke");
  });
  assert.equal((await watched).status, "timeout");
  state = markTimeoutAfterSend(state, 60);
  rejectSend({ code: 4001, message: "user rejected" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(state.allowNewSend, false);
  assert.equal(state.phase, "unknown");
  assert.match(state.lines.at(-1) ?? "", /code 4001/);
  assert.equal(state.lines.some((line) => line.includes("[object Object]")), false);
});

test("explicit clear is local and a pending note keeps the lock", () => {
  const locked = incidentLock();
  assert.equal(locked.allowNewSend, false);
  const stillPending = rememberPending(locked);
  assert.equal(stillPending.allowNewSend, false);
  assert.equal(markExplicitClear(stillPending).allowNewSend, true);
  const cleared = markExplicitClear(locked);
  assert.equal(cleared.phase, "ready");
  assert.match(cleared.lines.at(-1) ?? "", /没有调用 eth_sendTransaction/);
  const sent = markHash(cleared, `0x${"11".repeat(32)}`);
  assert.equal(markExplicitClear(sent), sent);
});

test("pre-send failure can prepare again, and a non-hash late value stays unknown", () => {
  const ready = markExplicitClear(incidentLock());
  const stopped = markPreSendStop(ready, "当前链不是 61999。还没有调用 eth_sendTransaction。");
  assert.equal(stopped.allowNewSend, true);
  assert.equal(stopped.invoked, false);
  const unknown = markLateNonHash(markTimeoutAfterSend(markAwaitingSend(ready, "已调用。"), 60), { code: -32603 });
  assert.equal(unknown.allowNewSend, false);
  assert.match(unknown.lines.at(-1) ?? "", /code -32603/);
});

test("provider selection prefers MetaMask and reports currentProvider", () => {
  const metaMask = { isMetaMask: true, request: async () => "ok", chainId: "0xf22f", selectedAddress: FROM, networkVersion: "61999" };
  const other = { isMetaMask: false, request: async () => "other" };
  const injected = { providers: [other, metaMask], isMetaMask: false, request: other.request, currentProvider: other };
  const selected = selectMetaMask(injected);
  assert.equal(selected.ok, true);
  if (selected.ok) assert.equal(selected.provider, metaMask);
  const same = { ...metaMask, currentProvider: null as unknown };
  same.currentProvider = same;
  const facts = readProviderFacts(same);
  assert.match(providerSummary(facts), /isMetaMask 是/);
  assert.match(providerSummary(facts), /同一对象/);
  const missing = selectMetaMask(other);
  assert.equal(missing.ok, false);
});

test("reload keeps an unknown send locked", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) };
  assert.equal(loadSendState(storage).allowNewSend, true);
  const stored = markTimeoutAfterSend(markAwaitingSend(markExplicitClear(incidentLock()), "已调用。"), 60);
  storage.setItem("gec-deploy-send-v3", JSON.stringify({ ...stored, phase: "awaiting-wallet" }));
  const loaded = loadSendState(storage);
  assert.equal(loaded.allowNewSend, false);
  assert.equal(loaded.phase, "unknown");
  assert.match(loaded.lines.at(-1) ?? "", /接不住/);
});
