import { createPublicClient, decodeFunctionResult, encodeFunctionData, http } from "viem";

import abiJson from "../../../../fixtures/public/CommitObligation.abi.json";
import snapshotJson from "../../../../fixtures/public/arkhai-public-read.json";

export const runtime = "nodejs";

const abi = abiJson.abi;
const baseObligation = "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2" as const;
const snapshot = snapshotJson as {
  readAt?: string;
  fulfillmentCount?: number;
  escrowCount?: number;
  sepoliaCommitObligationCount?: number;
  linkedEscrowDemands?: number;
  fulfillments?: Array<Record<string, unknown>>;
  escrows?: Array<Record<string, unknown>>;
};

export async function GET() {
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
  const liveAvailable = liveError === null;
  return Response.json({
    ok: liveAvailable,
    liveAvailable,
    frozenSnapshot: true,
    createdByThisProject: false,
    hostedCourtCase: false,
    readAt: snapshot.readAt ?? null,
    fulfillmentCount: snapshot.fulfillmentCount ?? 0,
    escrowCount: snapshot.escrowCount ?? 0,
    sepoliaCommitObligationCount: snapshot.sepoliaCommitObligationCount ?? 0,
    linkedEscrowDemands: snapshot.linkedEscrowDemands ?? 0,
    liveSchema,
    liveError: liveAvailable ? null : `第三方实时 schema 未配置或不可用。${liveError}`,
    fulfillments: snapshot.fulfillments ?? [],
    escrows: snapshot.escrows ?? [],
    note: liveAvailable
      ? "这些 attestation 属于其他账户。实时 schema 来自这次读取。它们不是本钱包创建的托管 escrow。"
      : "实时 Base Sepolia schema 没有读到。下列回执只是仓库里的冻结快照，不能当成这次请求刚刚核对成功。",
  });
}
