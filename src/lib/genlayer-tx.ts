function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return null;
}

export type GenLayerLookup = {
  ok: true;
  found: boolean;
  hash: string;
  status: string | null;
  resultName: string | null;
  resultCode: string | null;
  executionResults: string[];
  contractAddress: string | null;
  from: string | null;
  to: string | null;
  value: string | null;
  evmStatus: string | null;
  genvmError: string | null;
  note: string;
};

export function parseGenLayerTransaction(tx: unknown, receipt: unknown, hash: string): GenLayerLookup {
  const record = asRecord(tx);
  if (!record) {
    return {
      ok: true,
      found: false,
      hash,
      status: null,
      resultName: null,
      resultCode: null,
      executionResults: [],
      contractAddress: null,
      from: null,
      to: null,
      value: null,
      evmStatus: null,
      genvmError: null,
      note: "Studionet 没有这笔交易。MetaMask 的 Confirmed 不能代替这次查询。",
    };
  }
  const data = asRecord(record.data);
  const consensus = asRecord(record.consensus_data);
  const receipts = Array.isArray(consensus?.leader_receipt) ? consensus.leader_receipt : [];
  const executionResults = receipts
    .map((item) => text(asRecord(item)?.execution_result))
    .filter((item): item is string => item !== null);
  const first = asRecord(receipts[0]);
  const genvm = asRecord(first?.genvm_result);
  const evm = asRecord(receipt);
  const execution = executionResults[0] ?? null;
  return {
    ok: true,
    found: true,
    hash,
    status: text(record.status),
    resultName: text(record.result_name),
    resultCode: text(record.result),
    executionResults,
    contractAddress: text(data?.contract_address) ?? text(record.recipient) ?? text(record.to_address),
    from: text(record.from_address) ?? text(record.sender) ?? text(evm?.from),
    to: text(record.to_address) ?? text(record.recipient) ?? text(evm?.to),
    value: text(record.value) ?? text(evm?.value),
    evmStatus: text(evm?.status),
    genvmError: text(genvm?.error_description),
    note:
      execution === "SUCCESS"
        ? "GenVM execution_result 是 SUCCESS。这和 MetaMask Activity 的 Confirmed 不是同一件事；这里以 leader_receipt 为准。"
        : "已读到 GenLayer 交易。没有 SUCCESS 之前，不要把它写成部署成功，也不要再部署。",
  };
}
