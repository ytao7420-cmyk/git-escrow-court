export const FROZEN_SOURCE_SHA256 =
  "4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e";
export const FROZEN_TO = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575";
export const FROZEN_SELECTOR = "0x27241a99";
export const FROZEN_CALLDATA_BYTES = 14948;
export const SDK_VERSION = "1.1.8";
export const PARAM_TYPES = "address,address,uint256,uint256,bytes";
export const FROZEN_FROM = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";
export const FROZEN_FEE_CAP_WEI = "1000000000000000";

export type DeployPayload = {
  to: string;
  data: string;
  value: string;
  chainId: number;
  chainIdHex: string;
  from: string;
  feeCapWei: string;
  feeCap: string;
  selector: string;
  calldataBytes: number;
  sourceSha256: string;
  rpc: string;
  method: string;
  contract: string;
  sdkVersion: string;
  paramTypes: string;
  abiInputCount: number;
  fallbackUsed: boolean;
};

function same(left: string | number, right: string | number) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

export function deployRefusal(payload: Partial<DeployPayload> | null | undefined): string | null {
  if (!payload) return "没有未签名 payload。拒绝签名。";
  if (!same(payload.sourceSha256 ?? "", FROZEN_SOURCE_SHA256)) {
    return `sourceSHA ${payload.sourceSha256 || "空"} 与冻结源不一致。拒绝签名。`;
  }
  if (payload.chainId !== 61999 || !same(payload.chainIdHex ?? "", "0xf22f")) {
    return "chain 不是 Studionet 61999。拒绝签名。";
  }
  if (payload.value !== "0x0") return "value 不是 0x0。拒绝签名。";
  if (!same(payload.to ?? "", FROZEN_TO)) return "to 不是共识入口。拒绝签名。";
  if (payload.sdkVersion !== SDK_VERSION || payload.abiInputCount !== 5 || payload.paramTypes !== PARAM_TYPES) {
    return "payload 不是 genlayer-js 1.1.8 的五参主路径。拒绝签名。";
  }
  if (payload.fallbackUsed !== false) return "六参 fallback 没有真实 ABI 不匹配，拒绝签名。";
  if (!same(payload.selector ?? "", FROZEN_SELECTOR)) return "selector 不是五参主路径 0x27241a99。拒绝签名。";
  if (!payload.data || !payload.data.toLowerCase().startsWith(FROZEN_SELECTOR)) {
    return "data 不以 selector 开头。拒绝签名。";
  }
  const dataBytes = (payload.data.length - 2) / 2;
  if (dataBytes !== FROZEN_CALLDATA_BYTES || payload.calldataBytes !== FROZEN_CALLDATA_BYTES) {
    return `dataBytes ${dataBytes} 与冻结的 ${FROZEN_CALLDATA_BYTES} 不一致。拒绝签名。`;
  }
  if (!same(payload.from ?? "", FROZEN_FROM)) return "from 不是父级账户。拒绝签名。";
  if (payload.feeCapWei !== FROZEN_FEE_CAP_WEI) return "费用上限不是 0.001 测试 GEN。拒绝签名。";
  return null;
}

export function payloadMismatch(shown: DeployPayload, remote: Partial<DeployPayload> | null | undefined): string | null {
  if (!remote) return "接口没有返回 payload。拒绝签名。";
  const fields = ["to", "selector", "sourceSha256", "value", "chainIdHex", "calldataBytes", "data", "from", "feeCapWei"] as const;
  for (const field of fields) {
    if (!same(shown[field], remote[field] ?? "")) {
      return `页面上的 ${field} 与 /api/deploy-payload 不一致。拒绝签名。`;
    }
  }
  return deployRefusal(remote);
}
