export const SEND_STORAGE_KEY = "gec-deploy-send-v3";

const CODE_LABELS: Record<string, string> = {
  "4001": "用户拒绝",
  "-32602": "参数无效",
  "-32603": "钱包内部错误",
  "-32002": "已有未完成的钱包请求",
  "-32000": "节点拒绝",
};

export type SendPhase = "locked" | "ready" | "preparing" | "awaiting-wallet" | "unknown" | "hash";

export type SendState = {
  phase: SendPhase;
  invoked: boolean;
  allowNewSend: boolean;
  hash: string | null;
  lines: string[];
};

export type ProviderFacts = {
  present: boolean;
  isMetaMask: boolean;
  isBraveWallet: boolean;
  providerCount: number;
  selectedAddress: string;
  chainId: string;
  networkVersion: string;
  hasCurrentProvider: boolean;
  currentIsMetaMask: boolean | null;
  currentSameObject: boolean;
};

export type HexQuantity = { ok: true; hex: string } | { ok: false; error: string };

export type SendParams = {
  from: string;
  to: string;
  data: string;
  value: "0x0";
  gas: string;
  type?: "0x2";
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function pushUnique(chunks: string[], text: string) {
  const clean = text.trim();
  if (!clean || clean === "[object Object]" || chunks.includes(clean)) return;
  chunks.push(clean);
}

function walkError(value: unknown, chunks: string[], seen: Set<unknown>, depth: number) {
  if (value == null || depth > 5) return;
  if (typeof value === "string") {
    pushUnique(chunks, value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    pushUnique(chunks, String(value));
    return;
  }
  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  const record = value as Record<string, unknown>;
  if ("code" in record && (typeof record.code === "number" || typeof record.code === "string")) {
    const code = String(record.code);
    pushUnique(chunks, `code ${code}${CODE_LABELS[code] ? `（${CODE_LABELS[code]}）` : ""}`);
  }
  if (value instanceof Error) pushUnique(chunks, value.message);
  if ("message" in record) walkError(record.message, chunks, seen, depth + 1);
  if ("reason" in record) walkError(record.reason, chunks, seen, depth + 1);
  if ("data" in record) {
    if (typeof record.data === "string") pushUnique(chunks, `data ${record.data}`);
    else walkError(record.data, chunks, seen, depth + 1);
  }
  if ("cause" in record) walkError(record.cause, chunks, seen, depth + 1);
}

export function formatProviderError(error: unknown): string {
  const chunks: string[] = [];
  walkError(error, chunks, new Set(), 0);
  if (chunks.length === 0) return "钱包返回的对象没有 code、message 或 data。没有把它写成交易结果。";
  return chunks.join(" · ");
}

export function hexQuantity(value: unknown, label: string): HexQuantity {
  try {
    if (typeof value === "bigint") return { ok: true, hex: `0x${value.toString(16)}` };
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) return { ok: true, hex: `0x${BigInt(value).toString(16)}` };
    if (typeof value === "string" && /^0x[0-9a-fA-F]+$/.test(value)) return { ok: true, hex: `0x${BigInt(value).toString(16)}` };
    if (typeof value === "string" && /^\d+$/.test(value)) return { ok: true, hex: `0x${BigInt(value).toString(16)}` };
  } catch (error) {
    return { ok: false, error: `${label} 无法转成数量。${formatProviderError(error)}` };
  }
  return { ok: false, error: `${label} 不是十六进制数量。${formatProviderError(value)}` };
}

export function buildSendParams(input: {
  from: string;
  to: string;
  data: string;
  gas: unknown;
  gasPrice: unknown;
  baseFeePerGas: unknown | null;
  maxPriorityFeePerGas: unknown | null;
  feeCapWei: bigint;
}): { ok: true; params: SendParams; feeWei: bigint; kind: "legacy" | "eip1559"; note: string } | { ok: false; error: string } {
  if (input.from.toLowerCase() !== "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9") {
    return { ok: false, error: "from 不是父级账户。还没有调用 eth_sendTransaction。" };
  }
  const gas = hexQuantity(input.gas, "gas");
  if (!gas.ok) return { ok: false, error: gas.error };
  const gasPrice = hexQuantity(input.gasPrice, "gasPrice");
  if (!gasPrice.ok) return { ok: false, error: gasPrice.error };
  const eip1559 = input.baseFeePerGas !== null && input.baseFeePerGas !== undefined;
  if (!eip1559) {
    const feeWei = BigInt(gas.hex) * BigInt(gasPrice.hex);
    if (feeWei > input.feeCapWei) {
      return { ok: false, error: `估算费用 ${feeWei.toString()} wei 超过 0.001 测试 GEN。还没有调用 eth_sendTransaction。` };
    }
    return {
      ok: true,
      kind: "legacy",
      feeWei,
      note: "最新区块没有 baseFeePerGas。请求沿用 legacy 的 gas 和 gasPrice，不另写 maxFeePerGas。",
      params: { from: input.from, to: input.to, data: input.data, value: "0x0", gas: gas.hex, gasPrice: gasPrice.hex },
    };
  }
  const baseFee = hexQuantity(input.baseFeePerGas, "baseFeePerGas");
  if (!baseFee.ok) return { ok: false, error: baseFee.error };
  const priority = hexQuantity(input.maxPriorityFeePerGas ?? "0x0", "maxPriorityFeePerGas");
  if (!priority.ok) return { ok: false, error: priority.error };
  const maxFee = BigInt(gasPrice.hex) > BigInt(baseFee.hex) ? gasPrice.hex : baseFee.hex;
  const feeWei = BigInt(gas.hex) * BigInt(maxFee);
  if (feeWei > input.feeCapWei) {
    return { ok: false, error: `maxFeePerGas 乘 gas 是 ${feeWei.toString()} wei，超过 0.001 测试 GEN。还没有调用 eth_sendTransaction。` };
  }
  return {
    ok: true,
    kind: "eip1559",
    feeWei,
    note: "最新区块带 baseFeePerGas，钱包会按 EIP-1559 处理。这次不传 gasPrice，只传 gas、maxFeePerGas、maxPriorityFeePerGas。上一份页面把 gasPrice 和 gas 一起送进 eth_sendTransaction，MetaMask 会把它当成 legacy，确认框可以一直不返回。",
    params: {
      from: input.from,
      to: input.to,
      data: input.data,
      value: "0x0",
      gas: gas.hex,
      type: "0x2",
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: priority.hex,
    },
  };
}

export function readProviderFacts(ethereum: unknown): ProviderFacts {
  if (!ethereum || typeof ethereum !== "object") {
    return {
      present: false,
      isMetaMask: false,
      isBraveWallet: false,
      providerCount: 0,
      selectedAddress: "",
      chainId: "",
      networkVersion: "",
      hasCurrentProvider: false,
      currentIsMetaMask: null,
      currentSameObject: false,
    };
  }
  const record = ethereum as Record<string, unknown>;
  const providers = Array.isArray(record.providers) ? record.providers : [];
  const current = record.currentProvider;
  const currentRecord = current && typeof current === "object" ? (current as Record<string, unknown>) : null;
  return {
    present: true,
    isMetaMask: Boolean(record.isMetaMask),
    isBraveWallet: Boolean(record.isBraveWallet),
    providerCount: providers.length,
    selectedAddress: typeof record.selectedAddress === "string" ? record.selectedAddress : "",
    chainId: typeof record.chainId === "string" ? record.chainId : "",
    networkVersion: typeof record.networkVersion === "string" ? record.networkVersion : "",
    hasCurrentProvider: Boolean(current),
    currentIsMetaMask: currentRecord ? Boolean(currentRecord.isMetaMask) : null,
    currentSameObject: Boolean(current) && current === ethereum,
  };
}

export function providerSummary(facts: ProviderFacts): string {
  if (!facts.present) return "没有注入钱包。";
  return [
    `isMetaMask ${facts.isMetaMask ? "是" : "否"}`,
    `Brave ${facts.isBraveWallet ? "是" : "否"}`,
    `providers ${facts.providerCount}`,
    `selectedAddress ${facts.selectedAddress || "空"}`,
    `注入 chainId ${facts.chainId || "空"}`,
    `networkVersion ${facts.networkVersion || "空"}`,
    `currentProvider ${facts.hasCurrentProvider ? (facts.currentSameObject ? "与 window.ethereum 是同一对象" : "是另一个对象") : "没有"}`,
    facts.currentIsMetaMask === null ? "" : `currentProvider.isMetaMask ${facts.currentIsMetaMask ? "是" : "否"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function selectMetaMask(ethereum: unknown): { ok: true; provider: { request: (args: unknown) => Promise<unknown> }; note: string; facts: ProviderFacts } | { ok: false; error: string; facts: ProviderFacts } {
  const facts = readProviderFacts(ethereum);
  if (!ethereum || typeof ethereum !== "object" || typeof (ethereum as { request?: unknown }).request !== "function") {
    return { ok: false, error: "这个浏览器没有可请求的钱包。还没有调用 eth_sendTransaction。", facts };
  }
  const record = ethereum as { request: (args: unknown) => Promise<unknown>; providers?: unknown[] };
  const providers = Array.isArray(record.providers) ? record.providers : [];
  const metaMask = providers.find((item) => Boolean((item as { isMetaMask?: boolean }).isMetaMask) && typeof (item as { request?: unknown }).request === "function") as { request: (args: unknown) => Promise<unknown> } | undefined;
  if (metaMask) {
    return {
      ok: true,
      provider: metaMask,
      facts,
      note: providers.length > 1 ? "检测到多个注入钱包。请求只发给 isMetaMask 为真的那个。" : providerSummary(facts),
    };
  }
  if (facts.isMetaMask) return { ok: true, provider: record, facts, note: providerSummary(facts) };
  return { ok: false, error: `当前注入不是 MetaMask。${providerSummary(facts)} 还没有调用 eth_sendTransaction。`, facts };
}

export function incidentLock(): SendState {
  return {
    phase: "locked",
    invoked: false,
    allowNewSend: false,
    hash: null,
    lines: [
      "状态未知被改写了：MetaMask 已确认这笔 eth_sendTransaction 停在原生待确认页，没有哈希，也还没有进公开内存池。",
      "收款地址与今天的 Studio 前端和 genlayer-js 1.1.8 里 Studionet 61999 的 consensusMainContract 相同。不要因为 eth_getCode 为 0x 就另找一个地址。",
      "待确认交易的 selector 是 0xe71d5196，这是带 validUntil 的六个参数。当前这条链的官方 ABI 主路径是五个参数，selector 0x27241a99。不要点确认。",
      "在 MetaMask 里拒绝这一笔未广播的待确认。这一页的发送按钮保持关闭，不会再调用 eth_sendTransaction。",
    ],
  };
}

function withLine(state: SendState, line: string, patch: Partial<SendState> = {}): SendState {
  return { ...state, ...patch, lines: [...state.lines, line] };
}

export function rememberPending(state: SendState): SendState {
  return withLine(state, "已记下：钱包仍有待确认，或 Activity 里已有这笔交易。发送保持关闭。不要确认或取消对不上的弹窗，把哈希抄到只读查询。", {
    phase: "locked",
    allowNewSend: false,
  });
}

export function markExplicitClear(state: SendState): SendState {
  if (state.hash || state.phase === "awaiting-wallet" || state.phase === "hash") return state;
  if (state.phase !== "locked" && state.phase !== "unknown") return state;
  return withLine(state, "已记下只读结论：待确认是空的，Activity 里没有新的部署。发送按钮只解除锁定，这一步没有调用 eth_sendTransaction。", {
    phase: "ready",
    invoked: false,
    allowNewSend: true,
  });
}

export function markPreparing(state: SendState): SendState {
  if (!state.allowNewSend || state.phase !== "ready") return state;
  return { ...state, phase: "preparing" };
}

export function markAwaitingSend(state: SendState, detail: string): SendState {
  return withLine(state, detail, { phase: "awaiting-wallet", invoked: true, allowNewSend: false });
}

export function markTimeoutAfterSend(state: SendState, seconds: number): SendState {
  if (!state.invoked) return state;
  return withLine(
    state,
    `eth_sendTransaction 已调用，${seconds} 秒没有返回。状态未知。发送按钮保持关闭。这不是“可以重发”的结论。迟到的哈希或错误仍会补进这条记录。`,
    { phase: "unknown", allowNewSend: false },
  );
}

export function markHash(state: SendState, hash: string): SendState {
  return withLine(state, `钱包返回哈希 ${hash}。这只是哈希，还不是执行成功。发送保持关闭，不会再发一次。`, {
    phase: "hash",
    invoked: true,
    allowNewSend: false,
    hash,
  });
}

export function markLateNonHash(state: SendState, value: unknown): SendState {
  return withLine(state, `迟到的返回不是交易哈希。${formatProviderError(value)}。状态仍未知，发送保持关闭。`, {
    phase: state.invoked ? "unknown" : state.phase,
    allowNewSend: false,
  });
}

export function markProviderFailure(state: SendState, error: unknown, stage: "before-send" | "after-invoke"): SendState {
  const detail = formatProviderError(error);
  if (stage === "before-send" && !state.invoked) {
    return withLine(state, `${detail}。还没有调用 eth_sendTransaction。`, {
      phase: state.allowNewSend ? "ready" : state.phase,
    });
  }
  return withLine(state, `${detail}。eth_sendTransaction 已经调用过。这个错误不能单独作为重发许可；先看 MetaMask 待确认和 Activity。`, {
    phase: state.hash ? "hash" : "unknown",
    invoked: true,
    allowNewSend: false,
  });
}

export function markPreSendStop(state: SendState, line: string): SendState {
  if (state.invoked) return markProviderFailure(state, line, "after-invoke");
  return withLine(state, line, { phase: state.allowNewSend ? "ready" : state.phase });
}

export function readyAfterRejection(): SendState {
  return {
    phase: "ready",
    invoked: false,
    allowNewSend: true,
    hash: null,
    lines: [
      "旧的 0xe71d5196 Sending 0 GEN 请求已经在 MetaMask 里拒绝，不再 pending，也没有新的部署哈希。",
      "Activity 里 2026-11-21 02:44 的 Confirmed 是更早的历史，不是这次部署。",
      "这一页只准备 genlayer-js 1.1.8 的五参 addTransaction，selector 0x27241a99。没有 ABI 不匹配，不发送六参 fallback。",
    ],
  };
}

export function officialWalletParams(input: {
  from: string;
  to: string;
  data: string;
  gas: unknown;
  gasPrice: unknown;
  nonce: unknown;
  feeCapWei: bigint;
  selector: string;
}): { ok: true; params: Record<string, string>; feeWei: bigint; note: string } | { ok: false; error: string } {
  if (!input.data.toLowerCase().startsWith(input.selector.toLowerCase())) {
    return { ok: false, error: "data 不以当前主路径 selector 开头。还没有调用 eth_sendTransaction。" };
  }
  const gas = hexQuantity(input.gas, "gas");
  if (!gas.ok) return gas;
  const gasPrice = hexQuantity(input.gasPrice, "gasPrice");
  if (!gasPrice.ok) return gasPrice;
  const nonce = hexQuantity(input.nonce, "nonce");
  if (!nonce.ok) return nonce;
  const feeWei = BigInt(gas.hex) * BigInt(gasPrice.hex);
  if (feeWei > input.feeCapWei) {
    return { ok: false, error: `gas 乘 gasPrice 是 ${feeWei.toString()} wei，超过 0.001 测试 GEN。还没有调用 eth_sendTransaction。` };
  }
  return {
    ok: true,
    feeWei,
    note: "参数对齐 genlayer-js 1.1.8 的钱包发送：type 0x0、gas、gasPrice、nonce。gas 限额不是 ABI 正确的证据。",
    params: {
      from: input.from,
      to: input.to,
      data: input.data,
      value: "0x0",
      gas: gas.hex,
      gasPrice: gasPrice.hex,
      nonce: nonce.hex,
      type: "0x0",
      chainId: "0xf22f",
    },
  };
}

export function loadSendState(storage: StorageLike | null): SendState {
  if (!storage) return readyAfterRejection();
  const raw = storage.getItem(SEND_STORAGE_KEY);
  if (!raw) return readyAfterRejection();
  try {
    const parsed = JSON.parse(raw) as Partial<SendState>;
    if (!parsed || !Array.isArray(parsed.lines)) return incidentLock();
    const hash = typeof parsed.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(parsed.hash) ? parsed.hash : null;
    if (hash) return { phase: "hash", invoked: true, allowNewSend: false, hash, lines: parsed.lines.map(String) };
    if (parsed.phase === "ready" && parsed.allowNewSend === true && parsed.invoked === false) {
      return { phase: "ready", invoked: false, allowNewSend: true, hash: null, lines: parsed.lines.map(String) };
    }
    const lines = parsed.lines.map(String);
    if (parsed.phase === "awaiting-wallet") {
      lines.push("页面重新加载后接不住同一次钱包请求。状态仍未知。到 Activity 里核对，不要再点发送。");
    }
    return { phase: parsed.phase === "unknown" || parsed.phase === "awaiting-wallet" ? "unknown" : "locked", invoked: Boolean(parsed.invoked), allowNewSend: false, hash: null, lines };
  } catch {
    return incidentLock();
  }
}

export function saveSendState(storage: StorageLike | null, state: SendState) {
  storage?.setItem(SEND_STORAGE_KEY, JSON.stringify(state));
}

export function watchWalletRequest<T>(
  work: Promise<T>,
  ms: number,
  onLate: (event: { kind: "value"; value: T } | { kind: "error"; error: unknown }) => void,
): Promise<{ status: "value"; value: T } | { status: "timeout" } | { status: "error"; error: unknown }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ status: "timeout" });
    }, ms);
    work.then(
      (value) => {
        if (settled) {
          onLate({ kind: "value", value });
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({ status: "value", value });
      },
      (error: unknown) => {
        if (settled) {
          onLate({ kind: "error", error });
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({ status: "error", error });
      },
    );
  });
}

export function isTxHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}
