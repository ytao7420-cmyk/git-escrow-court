import { CaseSubmit } from "@/components/case-submit";
import { ChainRecord } from "@/components/chain-record";
import { PublicReceipts } from "@/components/public-receipts";

export default function PublicReceiptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">公共 git-escrow 回执</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          这里读官方 CommitObligation 和它所引用的托管 demand。这些回执是别人的链上记录，不是这个钱包创建的，也不是
          Internet Court 托管案件。
        </p>
      </div>
      <ChainRecord />
      <CaseSubmit />
      <PublicReceipts />
    </div>
  );
}
