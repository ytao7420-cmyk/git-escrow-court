import { readFileSync } from "node:fs";

import { WalletPanel } from "@/components/wallet-panel";
import { deployRefusal, type DeployPayload } from "@/lib/deploy-check";

export default function WalletPage() {
  let payload: DeployPayload | null = null;
  let readError = "";
  try {
    payload = JSON.parse(readFileSync("fixtures/public/unsigned-deploy.json", "utf8")) as DeployPayload;
  } catch (error) {
    readError = error instanceof Error ? error.message : "unsigned-deploy.json 读不到";
  }
  const refusal = payload ? deployRefusal(payload) : "没有未签名 payload。拒绝签名。";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">在 Studionet 61999 部署 GitEscrowCourt</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          部署交易 0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f 已在 Studionet 终局。selector 0x27241a99。GenVM execution_result 是 SUCCESS，合约地址 0x37383a73306B8F31d9158C3419C29EED856cc1Bc。这一页不会再部署。下一步只在公共回执页对这个地址提交同一张第三方案件。
        </p>
      </div>
      {payload && !refusal ? (
        <WalletPanel payload={payload} />
      ) : (
        <p>
          部署入口已关闭：{refusal || readError}。没有请求钱包。
        </p>
      )}
    </div>
  );
}
