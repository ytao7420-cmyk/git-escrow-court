import { createPublicClient, decodeFunctionResult, encodeFunctionData, http } from "viem";

import abiJson from "../../../../../fixtures/public/CommitObligation.abi.json";

export const runtime = "nodejs";

const rpc = "https://base-sepolia.gateway.tenderly.co";
const obligation = "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2" as const;
const eas = "0x4200000000000000000000000000000000000021" as const;
const uid = "0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b" as const;
const refUID = "0xaeedea1859650ca34ff97bae7ef94118d8522b5652ea9b33ef7280e742ee3228" as const;

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
] as const;

export async function GET() {
  const client = createPublicClient({ transport: http(rpc, { timeout: 20_000 }) });
  const checks: Record<string, { ok: boolean; actual?: string; expected: string }> = {};
  try {
    const chainId = await client.getChainId();
    checks.chainId = { ok: chainId === 84532, actual: String(chainId), expected: "84532" };
    const schemaCall = encodeFunctionData({ abi: abiJson.abi, functionName: "getSchema" });
    const schemaRaw = await client.call({ to: obligation, data: schemaCall });
    const schema = decodeFunctionResult({
      abi: abiJson.abi,
      functionName: "getSchema",
      data: schemaRaw.data ?? "0x",
    }) as { uid: string; schema: string };
    checks.schema = {
      ok: schema.schema === "string commitHash,uint8 commitAlgo,string[] hosts",
      actual: schema.schema,
      expected: "string commitHash,uint8 commitAlgo,string[] hosts",
    };
    checks.schemaUid = {
      ok: schema.uid === "0x28eb84f1eb9a9e6954693457db431a1db30e9e077b08238d6f424e2e643201ce",
      actual: schema.uid,
      expected: "0x28eb84f1eb9a9e6954693457db431a1db30e9e077b08238d6f424e2e643201ce",
    };
    const dataCall = encodeFunctionData({
      abi: abiJson.abi,
      functionName: "getObligationData",
      args: [uid],
    });
    const dataRaw = await client.call({ to: obligation, data: dataCall });
    const obligationData = decodeFunctionResult({
      abi: abiJson.abi,
      functionName: "getObligationData",
      data: dataRaw.data ?? "0x",
    }) as { commitHash: string; hosts: string[] };
    checks.solutionCommit = {
      ok: obligationData.commitHash === "164d6a980a19955e9e712f6824951c8d30256091",
      actual: obligationData.commitHash,
      expected: "164d6a980a19955e9e712f6824951c8d30256091",
    };
    checks.solutionRepo = {
      ok: obligationData.hosts[0] === "https://github.com/mlegls/git-escrow-bun-test-fulfillment.git",
      actual: obligationData.hosts[0] ?? "",
      expected: "https://github.com/mlegls/git-escrow-bun-test-fulfillment.git",
    };
    const fulfillment = await client.readContract({ address: eas, abi: easAbi, functionName: "getAttestation", args: [uid] });
    checks.refUID = { ok: fulfillment.refUID === refUID, actual: fulfillment.refUID, expected: refUID };
    const escrow = await client.readContract({
      address: eas,
      abi: easAbi,
      functionName: "getAttestation",
      args: [refUID],
    });
    const { decodeAbiParameters, parseAbiParameters } = await import("viem");
    const outer = decodeAbiParameters(
      parseAbiParameters("(address arbiter, bytes demand, address token, uint256 amount)"),
      escrow.data,
    )[0];
    const inner = decodeAbiParameters(parseAbiParameters("(address oracle, bytes data)"), outer.demand)[0];
    const tests = decodeAbiParameters(
      parseAbiParameters("(string testsCommitHash, uint8 testsCommitAlgo, string[] hosts)"),
      inner.data,
    )[0];
    checks.testsRepo = {
      ok: tests.hosts[0] === "https://github.com/mlegls/git-escrow-bun-test-demand.git",
      actual: tests.hosts[0] ?? "",
      expected: "https://github.com/mlegls/git-escrow-bun-test-demand.git",
    };
    checks.testsCommit = {
      ok: tests.testsCommitHash === "3680b366c331d145a1bbfd98fc89bb5d0e0225cb",
      actual: tests.testsCommitHash,
      expected: "3680b366c331d145a1bbfd98fc89bb5d0e0225cb",
    };
    const ok = Object.values(checks).every((item) => item.ok);
    return Response.json({
      ok,
      thirdParty: true,
      hostedCourtCase: false,
      contract: obligation,
      attestationUid: uid,
      checks,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Base Sepolia read failed", checks },
      { status: 502 },
    );
  }
}
