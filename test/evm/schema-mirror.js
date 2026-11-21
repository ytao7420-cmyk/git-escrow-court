const assert = require("node:assert/strict");
const fs = require("node:fs");
const hre = require("hardhat");
const { decodeAbiParameters, encodeAbiParameters, parseAbiParameters } = require("viem");

describe("CommitSchemaMirror", function () {
  it("round-trips tests-repo and tests-commit with the git-escrows ABI", async function () {
    const pass = JSON.parse(fs.readFileSync("fixtures/cases/pass.json", "utf8"));
    const receipt = pass.partnerInput.receipt;
    const testsRepo = receipt["tests-repo"];
    const testsCommit = receipt["tests-commit"];
    const algo = Number(receipt.testsCommitAlgo);

    const mirror = await hre.viem.deployContract("CommitSchemaMirror");
    const encoded = await mirror.read.encodeDemand([testsCommit, algo, [testsRepo]]);
    const flat = encodeAbiParameters(
      parseAbiParameters("string testsCommitHash, uint8 testsCommitAlgo, string[] hosts"),
      [testsCommit, algo, [testsRepo]],
    );
    assert.equal(encoded.toLowerCase(), flat.toLowerCase());

    const wrapped = encodeAbiParameters(
      parseAbiParameters("(string testsCommitHash, uint8 testsCommitAlgo, string[] hosts)"),
      [{ testsCommitHash: testsCommit, testsCommitAlgo: algo, hosts: [testsRepo] }],
    );
    assert.notEqual(
      wrapped.toLowerCase(),
      encoded.toLowerCase(),
      "the parenthesized viem tuple adds an offset that CommitObligation.abi.encode does not",
    );

    const decoded = await mirror.read.decodeDemand([encoded]);
    assert.equal(decoded[0], testsCommit);
    assert.equal(Number(decoded[1]), 0);
    assert.equal(decoded[2][0], testsRepo);

    const flatDecoded = decodeAbiParameters(
      parseAbiParameters("string testsCommitHash, uint8 testsCommitAlgo, string[] hosts"),
      encoded,
    );
    assert.equal(flatDecoded[0], testsCommit);
    assert.equal(flatDecoded[2][0], testsRepo);
    assert.equal(Object.hasOwn(receipt, "tests-repo"), true);
    assert.equal(Object.hasOwn(receipt, "tests-commit"), true);
    assert.equal(Object.hasOwn(receipt, "release-diff"), false);
  });
});
