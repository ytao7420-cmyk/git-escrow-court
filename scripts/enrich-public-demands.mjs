import { createPublicClient, http, decodeAbiParameters, parseAbiParameters } from "viem";
import { readFileSync, writeFileSync } from "node:fs";

const path = "fixtures/public/arkhai-public-read.json";
const snapshot = JSON.parse(readFileSync(path, "utf8"));
const eas = {
  "base-sepolia": "0x4200000000000000000000000000000000000021",
  sepolia: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
};
const rpc = {
  "base-sepolia": "https://base-sepolia.gateway.tenderly.co",
  sepolia: "https://sepolia.gateway.tenderly.co",
};
const abi = [
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
];
const clients = new Map();
function clientFor(network) {
  if (!clients.has(network)) {
    clients.set(network, createPublicClient({ transport: http(rpc[network], { timeout: 20000 }) }));
  }
  return clients.get(network);
}

let linked = 0;
for (const item of snapshot.fulfillments) {
  if (!item.refUID || item.refUID === `0x${"0".repeat(64)}`) continue;
  try {
    const att = await clientFor(item.network).readContract({
      address: eas[item.network],
      abi,
      functionName: "getAttestation",
      args: [item.refUID],
    });
    const outer = decodeAbiParameters(
      parseAbiParameters("(address arbiter, bytes demand, address token, uint256 amount)"),
      att.data,
    )[0];
    const inner = decodeAbiParameters(parseAbiParameters("(address oracle, bytes data)"), outer.demand)[0];
    const tests = decodeAbiParameters(
      parseAbiParameters("(string testsCommitHash, uint8 testsCommitAlgo, string[] hosts)"),
      inner.data,
    )[0];
    item.testsRepo = tests.hosts[0] ?? null;
    item.testsCommit = tests.testsCommitHash;
    item.testsCommitAlgo = Number(tests.testsCommitAlgo);
    item.oracle = inner.oracle;
    item.escrowArbiter = outer.arbiter;
    item.token = outer.token;
    item.amount = outer.amount.toString();
    item.escrowSchema = att.schema;
    item.escrowAttester = att.attester;
    linked += 1;
  } catch (error) {
    item.demandDecodeError = String(error.shortMessage || error.message || error).slice(0, 180);
  }
}
snapshot.linkedEscrowDemands = linked;
writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n");
console.log("linked", linked, "of", snapshot.fulfillments.length);
