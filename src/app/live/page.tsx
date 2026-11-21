import { LivePanel } from "@/components/live-panel";

export default function LivePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">公共 RPC 只读</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          这里核对官方网络和 Arkhai 部署是否还在链上。它不运行记录档，也不生成托管案件编号。
        </p>
      </div>
      <LivePanel />
    </div>
  );
}
