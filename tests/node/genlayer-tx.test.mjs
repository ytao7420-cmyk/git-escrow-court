import assert from "node:assert/strict";
import test from "node:test";

import { parseGenLayerTransaction } from "../../src/lib/genlayer-tx.ts";

const hash = "0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f";

test("a GenLayer transaction without an Ethereum value still parses", () => {
  const parsed = parseGenLayerTransaction(
    {
      status: "FINALIZED",
      result: 6,
      result_name: "MAJORITY_AGREE",
      value: 0,
      from_address: "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9",
      to_address: "0x37383a73306B8F31d9158C3419C29EED856cc1Bc",
      data: { contract_address: "0x37383a73306B8F31d9158C3419C29EED856cc1Bc" },
      consensus_data: {
        leader_receipt: [
          { execution_result: "SUCCESS", genvm_result: { error_description: null } },
          { execution_result: "SUCCESS" },
        ],
      },
    },
    { status: "0x1", value: undefined },
    hash,
  );
  assert.equal(parsed.found, true);
  assert.equal(parsed.executionResults.join(","), "SUCCESS,SUCCESS");
  assert.equal(parsed.contractAddress, "0x37383a73306B8F31d9158C3419C29EED856cc1Bc");
  assert.equal(parsed.value, "0");
  assert.equal(parsed.status, "FINALIZED");
});

test("a missing transaction does not throw", () => {
  const parsed = parseGenLayerTransaction(null, { value: undefined }, hash);
  assert.equal(parsed.found, false);
  assert.equal(parsed.executionResults.length, 0);
});
