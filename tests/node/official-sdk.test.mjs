import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { abi } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { encodeFunctionData, zeroAddress } from "viem";

const SENDER = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

test("genlayer-js 1.1.8 five-argument encoding matches the unsigned payload byte for byte", () => {
  const source = readFileSync("contracts/git_escrow_court.py");
  const payload = JSON.parse(readFileSync("fixtures/public/unsigned-deploy.json", "utf8"));
  const fn = studionet.consensusMainContract.abi.find((item) => item.type === "function" && item.name === "addTransaction");
  assert.equal(fn.inputs.length, 5);
  assert.equal(fn.inputs.map((item) => item.type).join(","), "address,address,uint256,uint256,bytes");
  const inner = abi.transactions.serialize([
    new Uint8Array(source),
    abi.calldata.encode(abi.calldata.makeCalldataObject(undefined, [], undefined)),
    false,
  ]);
  const data = encodeFunctionData({
    abi: [fn],
    functionName: "addTransaction",
    args: [SENDER, zeroAddress, 5n, 3n, inner],
  });
  assert.equal(data, payload.data);
  assert.equal(data.slice(0, 10), "0x27241a99");
  assert.equal((data.length - 2) / 2, 14948);
  assert.equal(payload.calldataSha256, createHash("sha256").update(Buffer.from(data.slice(2), "hex")).digest("hex"));
  assert.equal(payload.fallbackUsed, false);
  const six = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "addTransaction",
        stateMutability: "nonpayable",
        inputs: [
          { name: "_sender", type: "address" },
          { name: "_recipient", type: "address" },
          { name: "_numOfInitialValidators", type: "uint256" },
          { name: "_maxRotations", type: "uint256" },
          { name: "_txData", type: "bytes" },
          { name: "_validUntil", type: "uint256" },
        ],
        outputs: [],
      },
    ],
    functionName: "addTransaction",
    args: [SENDER, zeroAddress, 5n, 3n, inner, 0n],
  });
  assert.equal(six.slice(0, 10), "0xe71d5196");
  assert.notEqual(six, data);
});

test("case review_case outer path uses the same five-argument selector", () => {
  const frozen = JSON.parse(readFileSync("fixtures/public/case-submit.json", "utf8"));
  const fn = studionet.consensusMainContract.abi.find((item) => item.type === "function" && item.name === "addTransaction");
  const argument = canonical(frozen.argument);
  assert.equal(createHash("sha256").update(argument).digest("hex"), frozen.argumentSha256);
  const inner = abi.transactions.serialize([
    abi.calldata.encode(abi.calldata.makeCalldataObject("review_case", [argument], undefined)),
    false,
  ]);
  assert.equal(createHash("sha256").update(Buffer.from(inner.slice(2), "hex")).digest("hex"), frozen.innerTxDataSha256);
  const data = encodeFunctionData({
    abi: [fn],
    functionName: "addTransaction",
    args: [SENDER, SENDER, 5n, 3n, inner],
  });
  assert.equal(data.slice(0, 10), "0x27241a99");
  assert.equal(frozen.outerSelector, "0x27241a99");
  assert.equal(frozen.fallbackUsed, false);
  const deployed = encodeFunctionData({
    abi: [fn],
    functionName: "addTransaction",
    args: [SENDER, "0x37383a73306B8F31d9158C3419C29EED856cc1Bc", 5n, 3n, inner],
  });
  assert.equal(deployed.slice(0, 10), "0x27241a99");
  assert.equal((deployed.length - 2) / 2, 2596);
  assert.equal(
    createHash("sha256").update(Buffer.from(deployed.slice(2), "hex")).digest("hex"),
    "64db1e58b5d92a15c3565acc4534fdb1fe1ced1d5577b53a082ae10febd84005",
  );
});
