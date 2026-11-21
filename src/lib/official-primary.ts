import { createHash } from "node:crypto";

import { abi } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { encodeFunctionData, type Hex } from "viem";

export const SDK_VERSION = "1.1.8";
export const PRIMARY_SELECTOR = "0x27241a99" as const;
export const FALLBACK_SELECTOR = "0xe71d5196" as const;
export const PARAM_TYPES = "address,address,uint256,uint256,bytes";
export const SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9" as const;
export const ZERO = "0x0000000000000000000000000000000000000000" as const;
export const SOURCE_SHA = "4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e";

type AbiFunction = {
  type: string;
  name?: string;
  inputs?: { name: string; type: string }[];
};

export function primaryAddTransaction() {
  const contract = studionet.consensusMainContract;
  if (!contract?.address || studionet.id !== 61999) {
    throw new Error("genlayer-js studionet consensus entry is missing");
  }
  const fn = (contract.abi as AbiFunction[]).find((item) => item.type === "function" && item.name === "addTransaction");
  if (!fn?.inputs) throw new Error("studionet ABI has no addTransaction");
  if (fn.inputs.length >= 6) {
    throw new Error("refusing the six-argument fallback without an ABI mismatch error from a real call");
  }
  if (fn.inputs.length !== 5 || fn.inputs.map((item) => item.type).join(",") !== PARAM_TYPES) {
    throw new Error(`studionet addTransaction inputs are not ${PARAM_TYPES}`);
  }
  return { fn, to: contract.address, chainId: studionet.id };
}

function encodeInner(parts: unknown[]): Hex {
  return abi.transactions.serialize(parts as never);
}

export function encodeDeployInner(source: Uint8Array): Hex {
  return encodeInner([
    source,
    abi.calldata.encode(abi.calldata.makeCalldataObject(undefined, [], undefined)),
    false,
  ]);
}

export function encodeReviewInner(argumentText: string): Hex {
  return encodeInner([
    abi.calldata.encode(abi.calldata.makeCalldataObject("review_case", [argumentText], undefined)),
    false,
  ]);
}

export function encodePrimary(recipient: Hex, inner: Hex): Hex {
  const { fn } = primaryAddTransaction();
  const data = encodeFunctionData({
    abi: [fn],
    functionName: "addTransaction",
    args: [SENDER, recipient, 5n, 3n, inner],
  } as never) as Hex;
  if (!data.startsWith(PRIMARY_SELECTOR)) {
    throw new Error(`primary selector is ${data.slice(0, 10)}, not ${PRIMARY_SELECTOR}`);
  }
  if (data.includes(FALLBACK_SELECTOR.slice(2))) {
    throw new Error("primary calldata contains the six-argument selector");
  }
  return data;
}

export function sourceSha256(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
