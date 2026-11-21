import { createPublicClient, http } from "viem";

export const runtime = "nodejs";

function formatGen(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

const account = "0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9";
const cited = "0xc5c132B69f57dAAAb75d9ebA86cab504b272Ccbc";
const sepoliaObligation = "0x5bf1EE1fEC1bC25d20C4537f74bD0909B195DEBd";
const sepoliaRegistry = "0x57D5165F9487F6E7bD6E6a24017FAdadc2b1D7D2";
const baseObligation = "0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2";

async function balance(rpc: string) {
  const client = createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
  try {
    const [chainId, wei, gas] = await Promise.all([
      client.getChainId(),
      client.getBalance({ address: account }),
      client.getGasPrice(),
    ]);
    return {
      rpc,
      chainId: String(chainId),
      balanceWei: wei.toString(),
      balanceGen: formatGen(wei),
      gasPriceWei: gas.toString(),
    };
  } catch (error) {
    return {
      rpc,
      chainId: null,
      balanceWei: null,
      balanceGen: null,
      gasPriceWei: null,
      error: error instanceof Error ? error.message : "rpc failed",
    };
  }
}

async function code(rpc: string, address: `0x${string}`) {
  const client = createPublicClient({ transport: http(rpc, { timeout: 8_000 }) });
  try {
    const bytecode = await client.getBytecode({ address });
    return { address, codeBytes: bytecode ? (bytecode.length - 2) / 2 : 0 };
  } catch (error) {
    return { address, codeBytes: null, error: error instanceof Error ? error.message : "rpc failed" };
  }
}

export async function GET() {
  const sepolia = "https://ethereum-sepolia-rpc.publicnode.com";
  const [studionet, studioDev, obligation, registry, base, citedCode, nonce, citedBalance] = await Promise.all([
    balance("https://studio.genlayer.com/api"),
    balance("https://studio-dev.genlayer.com/api"),
    code(sepolia, sepoliaObligation),
    code(sepolia, sepoliaRegistry),
    code("https://sepolia.base.org", baseObligation),
    code(sepolia, cited),
    createPublicClient({ transport: http(sepolia, { timeout: 8_000 }) })
      .getTransactionCount({ address: cited })
      .catch(() => null),
    createPublicClient({ transport: http(sepolia, { timeout: 8_000 }) })
      .getBalance({ address: cited })
      .catch(() => null),
  ]);

  const readable = obligation.codeBytes !== null || studionet.chainId !== null;
  return Response.json(
    {
      ok: readable,
      error: readable ? undefined : "public RPCs did not answer",
      checkedAt: new Date().toISOString(),
      verdict: null,
      reason: "No public git-escrow receipt was supplied. Live mode does not reuse the local fixture judgment.",
      genlayer: { studionet, studioDev },
      arkhai: {
        sepoliaCommitObligation: obligation,
        sepoliaRegistry: registry,
        baseCommitObligation: base,
        citedAddress: {
          address: cited,
          codeBytes: citedCode.codeBytes,
          nonce: nonce === null ? "unread" : nonce.toString(),
          balanceWei: citedBalance === null ? "unread" : citedBalance.toString(),
          deploymentRole: "contract/deployments/sepolia.json in arkhai-io/git-commit-trading records this address as deployer.",
          skillText: "The vendored make-git-escrow skill calls the same address a public demo oracle.",
          conclusion:
            citedCode.codeBytes === 0
              ? "The address has no contract code on Ethereum Sepolia. It is an account, not a verified listening oracle, and this run read no git-escrow test receipt from it."
              : "Bytecode was present. This run still has no git-escrow test receipt to review.",
        },
      },
    },
    { status: readable ? 200 : 502 },
  );
}
