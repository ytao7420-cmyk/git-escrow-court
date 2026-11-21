import { readFileSync } from "node:fs";
import { createPublicClient, decodeFunctionResult, encodeFunctionData, http } from "viem";

import abiJson from "../../../../fixtures/public/CommitObligation.abi.json";

export const runtime = "nodejs";

const abi = abiJson.abi;
const baseObligation = "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2" as const;

export async function GET() {
  const snapshot = JSON.parse(readFileSync("fixtures/public/arkhai-public-read.json", "utf8")) as {
    readAt: string;
    fulfillmentCount: number;
    escrowCount: number;
    sepoliaCommitObligationCount: number;
    linkedEscrowDemands?: number;
    fulfillments: Array<Record<string, unknown>>;
    escrows: Array<Record<string, unknown>>;
  };
  let liveSchema: string | null = null;
  let liveError: string | null = null;
  try {
    const client = createPublicClient({
      transport: http("https://base-sepolia.gateway.tenderly.co", { timeout: 12_000 }),
    });
    const data = encodeFunctionData({ abi, functionName: "getSchema" });
    const raw = await client.call({ to: baseObligation, data });
    const decoded = decodeFunctionResult({ abi, functionName: "getSchema", data: raw.data ?? "0x" }) as {
      schema: string;
      uid: string;
    };
    liveSchema = `${decoded.uid} ${decoded.schema}`;
  } catch (error) {
    liveError = error instanceof Error ? error.message : "schema read failed";
  }
  return Response.json({
    ok: liveError === null,
    createdByThisProject: false,
    hostedCourtCase: false,
    readAt: snapshot.readAt,
    fulfillmentCount: snapshot.fulfillmentCount,
    escrowCount: snapshot.escrowCount,
    sepoliaCommitObligationCount: snapshot.sepoliaCommitObligationCount,
    linkedEscrowDemands: snapshot.linkedEscrowDemands ?? 0,
    liveSchema,
    liveError,
    fulfillments: snapshot.fulfillments,
    escrows: snapshot.escrows,
    note: "These attestations belong to other accounts. They are not an Internet Court hosted case and they were not created by 0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9.",
  });
}
