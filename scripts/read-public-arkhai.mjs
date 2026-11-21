import { createPublicClient, http, decodeFunctionResult, encodeFunctionData, parseAbiItem } from "viem";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commitAbi = JSON.parse(
  readFileSync(resolve(root, "fixtures/public/CommitObligation.abi.json"), "utf8"),
).abi;
const event = parseAbiItem(
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
);
const easAbi = [
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

const networks = {
  sepolia: {
    chainId: 11155111,
    rpc: "https://sepolia.gateway.tenderly.co",
    eas: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
    commitObligation: "0x5bf1EE1fEC1bC25d20C4537f74bD0909B195DEBd",
    commitSchema: "0x2b21f8d37acd92f2e6c93a520397d8d90987ad7ff65d5bd1ec50710ffdf509bd",
    escrow: "0x6bcec91a89A63D50368BCe54Cb9eD0399992C18b",
    escrowSchema: "0xfe687b870877fbca2d4e575af3a863f82b81fab59529f13400b640bbd15d599a",
    fromBlock: 10245692n,
  },
  "base-sepolia": {
    chainId: 84532,
    rpc: "https://base-sepolia.gateway.tenderly.co",
    eas: "0x4200000000000000000000000000000000000021",
    commitObligation: "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2",
    commitSchema: "0x28eb84f1eb9a9e6954693457db431a1db30e9e077b08238d6f424e2e643201ce",
    fromBlock: 36434403n,
  },
};

async function scan(client, address, schema, from, latest) {
  const step = 250000n;
  const logs = [];
  let errors = 0;
  for (let start = from; start <= latest; start += step) {
    const end = start + step - 1n > latest ? latest : start + step - 1n;
    try {
      const batch = await client.getLogs({
        address,
        event,
        args: { schemaUID: schema },
        fromBlock: start,
        toBlock: end,
      });
      logs.push(...batch);
    } catch (error) {
      errors += 1;
      console.error(String(error.shortMessage || error.message || error).slice(0, 140));
    }
  }
  return { logs, errors };
}

async function decodeObligation(client, address, uid) {
  const data = encodeFunctionData({ abi: commitAbi, functionName: "getObligationData", args: [uid] });
  const raw = await client.call({ to: address, data });
  const decoded = decodeFunctionResult({ abi: commitAbi, functionName: "getObligationData", data: raw.data });
  return { commitHash: decoded.commitHash, commitAlgo: Number(decoded.commitAlgo), hosts: decoded.hosts };
}

const fulfillments = [];
const escrows = [];
for (const [name, net] of Object.entries(networks)) {
  const client = createPublicClient({ transport: http(net.rpc, { timeout: 30000 }) });
  const latest = await client.getBlockNumber();
  const scanned = await scan(client, net.eas, net.commitSchema, net.fromBlock, latest);
  console.error(name, "commit logs", scanned.logs.length, "errors", scanned.errors);
  for (const log of scanned.logs) {
    const decoded = await decodeObligation(client, net.commitObligation, log.args.uid);
    let refUID = null;
    let recipient = null;
    try {
      const att = await client.readContract({
        address: net.eas,
        abi: easAbi,
        functionName: "getAttestation",
        args: [log.args.uid],
      });
      refUID = att.refUID;
      recipient = att.recipient;
    } catch {
      refUID = null;
    }
    fulfillments.push({
      network: name,
      chainId: net.chainId,
      contract: net.commitObligation,
      schemaUid: net.commitSchema,
      uid: log.args.uid,
      tx: log.transactionHash,
      block: log.blockNumber.toString(),
      attester: log.args.attester,
      recipient,
      refUID,
      ...decoded,
      createdByThisProject: false,
      hostedCourtCase: false,
    });
  }
  if (net.escrow) {
    const escrowScan = await scan(client, net.eas, net.escrowSchema, net.fromBlock, latest);
    console.error(name, "escrow logs", escrowScan.logs.length, "errors", escrowScan.errors);
    for (const log of escrowScan.logs) {
      escrows.push({
        network: name,
        chainId: net.chainId,
        contract: net.escrow,
        schemaUid: net.escrowSchema,
        uid: log.args.uid,
        tx: log.transactionHash,
        block: log.blockNumber.toString(),
        attester: log.args.attester,
        createdByThisProject: false,
        note: "ERC20 escrow attestation. It is not decoded as a git tests-repo unless a later read of its demand succeeds.",
      });
    }
  }
}

const out = {
  readAt: new Date().toISOString(),
  parentWallet: "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9",
  notCreatedByThisProject: true,
  notAHostedCourtCase: true,
  sepoliaCommitObligationCount: fulfillments.filter((item) => item.network === "sepolia").length,
  fulfillmentCount: fulfillments.length,
  escrowCount: escrows.length,
  fulfillments,
  escrows,
};
mkdirSync(resolve(root, "fixtures/public"), { recursive: true });
writeFileSync(resolve(root, "fixtures/public/arkhai-public-read.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ fulfillments: fulfillments.length, escrows: escrows.length, hosts: fulfillments.slice(0, 3) }, null, 2));
