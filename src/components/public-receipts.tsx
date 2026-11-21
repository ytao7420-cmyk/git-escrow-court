"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  liveError?: string | null;
  liveSchema?: string | null;
  fulfillmentCount?: number;
  escrowCount?: number;
  sepoliaCommitObligationCount?: number;
  linkedEscrowDemands?: number;
  fulfillments?: Fulfillment[];
  error?: string;
};

type Review = { ok: boolean; error?: string; record?: { decision: string; mandateStatus: string; reasoning: string; limitations: string[] } };

export function PublicReceipts() {
  const [body, setBody] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/arkhai");
      setBody((await response.json()) as Payload);
    } catch (error) {
      setBody({ ok: false, error: error instanceof Error ? error.message : "读取失败" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reviewOne(uid: string) {
    setBusy(uid);
    setReview(null);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: "public-fulfillment", uid }),
      });
      setReview((await response.json()) as Review);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-sky-800/30 bg-sky-100 px-4 py-3 text-sm text-sky-950">
        <strong>只读公共回执。</strong>
        没有把这些交易说成父级钱包或本仓库创建的托管案件。本地夹具仍在「记录档复核」，两者不会混成一次成功。
      </section>
      {loading ? <p className="text-sm">正在核对 Base Sepolia 上的官方 schema，并列出已扫描到的 attestation。</p> : null}
      {body && !body.ok ? <p className="text-sm text-destructive">{body.liveError || body.error}</p> : null}
      {body?.ok ? (
        <>
          <p className="text-sm">{body.note}</p>
          <p className="font-mono text-xs">
            现场 schema {body.liveSchema} · CommitObligation 回执 {body.fulfillmentCount} · 其中 Sepolia{" "}
            {body.sepoliaCommitObligationCount} · 已连上 demand 的 {body.linkedEscrowDemands} · ERC20 escrow 日志{" "}
            {body.escrowCount}
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
                  <Button size="sm" variant="outline" disabled={busy === item.uid} onClick={() => void reviewOne(item.uid)}>
                    本地复核这张回执（不发送交易）
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {review ? (
            <Card>
              <CardHeader>
                <CardTitle>{review.ok ? `${review.record?.decision} / ${review.record?.mandateStatus}` : "复核没有写入"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{review.ok ? review.record?.reasoning : review.error}</p>
                {review.record?.limitations?.slice(0, 3).map((item) => (
                  <p key={item} className="text-muted-foreground">{item}</p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
