"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readResponseJson } from "@/lib/read-response";

type Fulfillment = {
  uid: string;
  network: string;
  tx: string;
  commitHash: string;
  hosts: string[];
  testsRepo?: string | null;
  testsCommit?: string | null;
  oracle?: string;
  amount?: string;
  token?: string;
  createdByThisProject: boolean;
};

type Payload = {
  ok: boolean;
  note?: string;
  liveAvailable?: boolean;
  frozenSnapshot?: boolean;
  liveError?: string | null;
  liveSchema?: string | null;
  fulfillmentCount?: number;
  escrowCount?: number;
  sepoliaCommitObligationCount?: number;
  linkedEscrowDemands?: number;
  fulfillments?: Fulfillment[];
  error?: string;
};

export function PublicReceipts() {
  const [body, setBody] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/arkhai");
      const parsed = await readResponseJson(response);
      if (!parsed.ok) {
        setBody({ ok: false, liveAvailable: false, error: parsed.error });
        return;
      }
      setBody(parsed.value as Payload);
    } catch (error) {
      setBody({ ok: false, liveAvailable: false, error: error instanceof Error ? error.message : "读取失败" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-sky-800/30 bg-sky-100 px-4 py-3 text-sm text-sky-950">
        <strong>只读公共回执。</strong>
        没有把这些交易说成父级钱包或本仓库创建的托管案件。本地夹具仍在「记录档复核」，两者不会混成一次成功。
      </section>
      {loading ? <p className="text-sm">正在查看第三方 schema。读不到就标成不可用，不用空响应假装成功。</p> : null}
      {body && !body.liveAvailable ? <p className="text-sm text-destructive">{body.liveError || body.error || "第三方实时读取不可用。"}</p> : null}
      {body && (body.frozenSnapshot || body.ok) ? (
        <>
          <p className="text-sm">{body.note}</p>
          <p className="font-mono text-xs">
            {body.liveAvailable ? `现场 schema ${body.liveSchema}` : "现场 schema 不可用"} · 冻结快照回执 {body.fulfillmentCount ?? 0} · 其中 Sepolia{" "}
            {body.sepoliaCommitObligationCount ?? 0} · 已连上 demand 的 {body.linkedEscrowDemands ?? 0} · ERC20 escrow 日志{" "}
            {body.escrowCount ?? 0}
          </p>
          <div className="space-y-3">
            {(body.fulfillments ?? []).slice(0, 6).map((item) => (
              <Card key={item.uid}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {item.network}
                    <Badge variant="outline">第三方</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="break-all font-mono text-xs">uid {item.uid}</p>
                  <p className="break-all font-mono text-xs">tx {item.tx}</p>
                  <p>solution {item.hosts?.[0]} @ {item.commitHash}</p>
                  <p>
                    tests-repo {item.testsRepo || "这张 CommitObligation 里没有"} @ {item.testsCommit || "没有"}
                  </p>
                  <p className="font-mono text-xs">oracle {item.oracle || "未从 demand 解出"}</p>
                  <p>公开站点不调用本地复核接口。这张卡片不能发送交易。</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
