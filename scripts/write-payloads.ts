import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import {
  FALLBACK_SELECTOR,
  PARAM_TYPES,
  PRIMARY_SELECTOR,
  SDK_VERSION,
  SENDER,
  SOURCE_SHA,
  ZERO,
  canonicalJson,
  encodeDeployInner,
  encodePrimary,
  encodeReviewInner,
  primaryAddTransaction,
  sourceSha256,
} from "../src/lib/official-primary.ts";

const source = new Uint8Array(readFileSync("contracts/git_escrow_court.py"));
const digest = sourceSha256(source);
if (digest !== SOURCE_SHA) {
  throw new Error(`contract source hash is ${digest}`);
}
const { to, chainId } = primaryAddTransaction();
const data = encodePrimary(ZERO, encodeDeployInner(source));
const payload = {
  purpose: "Deploy GitEscrowCourt on Studionet with genlayer-js 1.1.8 five-argument addTransaction. Value is zero.",
  signed: false,
  broadcast: false,
  sdkPackage: "genlayer-js",
  sdkVersion: SDK_VERSION,
  abiInputCount: 5,
  paramTypes: PARAM_TYPES,
  fallbackSelector: FALLBACK_SELECTOR,
  fallbackUsed: false,
  fallbackRule: "genlayer-js uses the six-argument encoding only after a real ABI mismatch error. This file does not send it.",
  chainId,
  chainIdHex: "0xf22f",
  rpc: "https://studio.genlayer.com/api",
  from: SENDER,
  to,
  value: "0x0",
  data,
  selector: data.slice(0, 10),
  method: `addTransaction(${PARAM_TYPES})`,
  arguments: {
    sender: SENDER,
    recipient: ZERO,
    numOfInitialValidators: 5,
    maxRotations: 3,
    constructorArguments: [],
    leaderOnly: false,
  },
  contract: "contracts/git_escrow_court.py",
  sourceSha256: digest,
  runner: "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6",
  calldataBytes: (data.length - 2) / 2,
  calldataSha256: createHash("sha256").update(Buffer.from(data.slice(2), "hex")).digest("hex"),
  feeCapWei: "1000000000000000",
  feeCap: "0.001 test GEN",
  allowlist: [61999],
  estimateIsNotAbiEvidence: true,
  rejectedPreviousSelector: FALLBACK_SELECTOR,
  historicalConfirmedNote: "A Confirmed Activity item at 2026-11-21 02:44 is older history, not this deploy.",
  ethSendTransaction: "only inside the button labeled 请 MetaMask 签名五参部署",
};
writeFileSync("fixtures/public/unsigned-deploy.json", `${JSON.stringify(payload, null, 2)}\n`);

const frozen = JSON.parse(readFileSync("fixtures/public/case-submit.json", "utf8")) as {
  argument: unknown;
  argumentSha256: string;
};
const argumentText = canonicalJson(frozen.argument);
const argumentSha256 = createHash("sha256").update(argumentText).digest("hex");
if (argumentSha256 !== frozen.argumentSha256) throw new Error("case argument hash drifted");
const inner = encodeReviewInner(argumentText);
const innerSha = createHash("sha256").update(Buffer.from(inner.slice(2), "hex")).digest("hex");
const next = {
  ...frozen,
  sdkPackage: "genlayer-js",
  sdkVersion: SDK_VERSION,
  outerSelector: PRIMARY_SELECTOR,
  outerMethod: `addTransaction(${PARAM_TYPES})`,
  paramTypes: PARAM_TYPES,
  abiInputCount: 5,
  fallbackSelector: FALLBACK_SELECTOR,
  fallbackUsed: false,
  consensus: to,
  from: SENDER,
  value: "0x0",
  chainId: 61999,
  innerTxDataSha256: innerSha,
  estimateIsNotAbiEvidence: true,
};
writeFileSync("fixtures/public/case-submit.json", `${JSON.stringify(next, null, 2)}\n`);
console.log(PRIMARY_SELECTOR, payload.calldataBytes, payload.calldataSha256, innerSha);
