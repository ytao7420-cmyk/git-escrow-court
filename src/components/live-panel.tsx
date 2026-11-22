"use client";

import { useEffect, useState } from "react";

import { Marks } from "@/components/marks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LiveBody = {
  ok: boolean;
  error?: string;
  checkedAt?: string;
  verdict: null;
  reason?: string;
  genlayer?: {
    studionet: ChainBalance;
    studioDev: ChainBalance;
  };
  arkhai?: {
    sepoliaCommitObligation: CodeFact;
    sepoliaRegistry: CodeFact;
    baseCommitObligation: CodeFact;
    citedAddress: {
      address: string;
      codeBytes: number;
      nonce: string;
      balanceWei: string;
      deploymentRole: string;
      skillText: string;
      conclusion: string;
    };
  };
};

type ChainBalance = {
  rpc: string;
  chainId: string | null;
  balanceWei: string | null;
  balanceGen: string | null;
  gasPriceWei: string | null;
  error?: string;
};

type CodeFact = { address: string; codeBytes: number | null; error?: string };

export function LivePanel() {
  const [body, setBody] = useState<LiveBody | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/live");
      setBody((await response.json()) as LiveBody);
    } catch (error) {
      setBody({
        ok: false,
        verdict: null,
        error: error instanceof Error ? error.message : "只读请求失败",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-sky-800/30 bg-sky-100 px-4 py-3 text-sm text-sky-950">
        <strong>只读余额和字节码。</strong>
        这一页不加载记录档，也不调用已部署的法庭合约。Studionet 的 get_record 在「公共回执」。
      </section>
      <Marks />
      <Button variant="outline" onClick={() => void load()}>
        再读一次公共 RPC
      </Button>
      {loading ? <Card><CardContent className="py-8 text-sm">正在读取 Studionet、Studio-dev、Sepolia 和 Base Sepolia。</CardContent></Card> : null}
      {body && !body.ok ? (
        <Card>
          <CardHeader><CardTitle>只读检查没有完成</CardTitle></CardHeader>
          <CardContent className="text-sm text-destructive">{body.error || "公共 RPC 没有返回可用结果。"}</CardContent>
        </Card>
      ) : null}
      {body?.ok ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">本案判断 <Badge variant="outline">不在此页</Badge></CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{body.reason}</CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <BalanceCard title="Studionet · 官方稳定托管环境" fact={body.genlayer!.studionet} note="推荐父级之后签名的网络。余额不能拿到 Studio-dev 上用。" />
            <BalanceCard title="Studio-dev · 另一条发布候选链" fact={body.genlayer!.studioDev} note="链 ID 和共识部署都不同。这里的余额不是 Studionet 的 10 GEN。" />
          </div>
          <Card>
            <CardHeader><CardTitle>Arkhai 公共部署</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Fact label="Sepolia CommitObligation" fact={body.arkhai!.sepoliaCommitObligation} />
              <Fact label="Sepolia GitIdentityRegistry" fact={body.arkhai!.sepoliaRegistry} />
              <Fact label="Base Sepolia CommitObligation" fact={body.arkhai!.baseCommitObligation} />
              <div className="rounded-md bg-secondary p-3">
                <p className="font-mono text-xs">{body.arkhai!.citedAddress.address}</p>
                <p className="mt-2">代码字节 {body.arkhai!.citedAddress.codeBytes} · nonce {body.arkhai!.citedAddress.nonce} · 余额 wei {body.arkhai!.citedAddress.balanceWei}</p>
                <p className="mt-2">{body.arkhai!.citedAddress.deploymentRole}</p>
                <p>{body.arkhai!.citedAddress.skillText}</p>
                <p className="mt-2 font-medium">{body.arkhai!.citedAddress.conclusion}</p>
              </div>
              <p className="text-xs text-muted-foreground">检查时间 {body.checkedAt}</p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function BalanceCard({ title, fact, note }: { title: string; fact: ChainBalance; note: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-mono text-xs">{fact.rpc}</p>
        {fact.error ? <p className="text-destructive">{fact.error}</p> : null}
        <p>链 ID {fact.chainId ?? "未读到"}</p>
        <p>余额 {fact.balanceGen ?? "未读到"} GEN</p>
        <p>eth_gasPrice {fact.gasPriceWei ?? "未读到"} wei</p>
        <p className="text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function Fact({ label, fact }: { label: string; fact: CodeFact }) {
  return (
    <p>
      {label} <span className="font-mono text-xs">{fact.address}</span> · 代码字节 {fact.codeBytes ?? "未读到"}
      {fact.error ? <span className="text-destructive"> {fact.error}</span> : null}
    </p>
  );
}
