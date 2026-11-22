"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runReproLifecycle, type ReproEncode, type ReproResult } from "@/lib/repro-lifecycle";
import { emptyReproGuard, loadReproGuard, saveReproGuard, type ReproGuard } from "@/lib/repro-shared";
import { formatProviderError, selectMetaMask } from "@/lib/wallet-transport";
import type { GenLayerLookup } from "@/lib/genlayer-tx";

type Description = {
  ok: boolean;
  error?: string;
  consensus?: string;
  caseId?: string;
  historicalCaseId?: string;
  contract?: string;
  expectedDecision?: string;
  argument?: { partnerInput?: { testResult?: null } };
};

export function ReproCase() {
  const [description, setDescription] = useState<Description | null>(null);
  const [guard, setGuard] = useState<ReproGuard>(emptyReproGuard());
  const [result, setResult] = useState<ReproResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGuard(loadReproGuard(window.sessionStorage));
    const controller = new AbortController();
    void fetch("/api/repro-case", { signal: controller.signal })
      .then((response) => response.json())
      .then((body: Description) => setDescription(body))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDescription({ ok: false, error: formatProviderError(error) });
      });
    return () => controller.abort();
  }, []);

  async function confirm() {
    if (busy || guard.locked || guard.hash) return;
    const selected = selectMetaMask((window as Window & { ethereum?: unknown }).ethereum);
    if (!selected.ok) {
      setResult({
        phase: "error",
        sent: false,
        hash: null,
        allowAnotherSend: true,
        decision: null,
        lines: [selected.error],
      });
      return;
    }
    if (!description?.ok || !description.consensus) {
      setResult({
        phase: "error",
        sent: false,
        hash: null,
        allowAnotherSend: true,
        decision: null,
        lines: [description?.error || "复现说明还没准备好。没有发送。"],
      });
      return;
    }
    setBusy(true);
    const next = await runReproLifecycle({
      userConfirmed: true,
      expectedConsensus: description.consensus,
      request: (args) => selected.provider.request(args),
      encode: async (sender) => {
        const response = await fetch("/api/repro-case", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sender, broadcast: false }),
        });
        return (await response.json()) as ReproEncode;
      },
      lookup: async (hash) => {
        const response = await fetch(`/api/tx?hash=${encodeURIComponent(hash)}`);
        return (await response.json()) as GenLayerLookup;
      },
      readback: async (caseId) => {
        const response = await fetch("/api/chain-record");
        const body = (await response.json()) as {
          ok: boolean;
          error?: string;
          records?: { caseId: string; record: { caseId?: string; decision?: string; mandateStatus?: string; violations?: string[]; reasoningSource?: string } | null }[];
        };
        if (!body.ok) return { ok: false as const, error: body.error || "链上读取失败" };
        const found = body.records?.find((item) => item.caseId === caseId)?.record;
        if (!found) return { ok: false as const, error: "list_cases 里还没有这个新案件" };
        return { ok: true as const, record: found };
      },
      intervalMs: 3_000,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    });
    const nextGuard: ReproGuard = next.hash
      ? { hash: next.hash, locked: true, lines: next.lines }
      : { hash: null, locked: !next.allowAnotherSend, lines: next.lines };
    saveReproGuard(window.sessionStorage, nextGuard);
    setGuard(nextGuard);
    setResult(next);
    setBusy(false);
  }

  const locked = guard.locked || Boolean(guard.hash) || busy;

  return (
    <Card>
      <CardHeader>
        <CardTitle>新测试案件，不是旧的终局记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          caseId {description?.caseId ?? "repro-missing-log-v1"}。旧案件 {description?.historicalCaseId ?? "public-0726369d528e"} 不在这笔交易里。
          合约 {description?.contract ?? "0x37383a73306B8F31d9158C3419C29EED856cc1Bc"}。方法只有 review_case。
        </p>
        <p>
          Studionet 61999 是测试网。value 是 0，费用上限 0.001 测试 GEN，不转移真实资产。testResult 是 null，所以预期是 {description?.expectedDecision ?? "escalate"} / missing-test-result。缺日志不是测试通过，也不是 LLM 判决。
        </p>
        <p>打开这一页只读取本地说明。它不连接钱包，不签名，也不发送。下面的按钮要你自己点击，钱包里还要再确认一次。</p>
        {guard.hash ? <p className="break-all font-mono text-xs">已有哈希 {guard.hash}。按钮保持关闭。</p> : null}
        <Button type="button" disabled={locked} onClick={() => void confirm()}>
          我确认，请钱包签名这笔新案件
        </Button>
        {(result?.lines ?? guard.lines).map((item, index) => (
          <p key={`${index}-${item}`}>{item}</p>
        ))}
      </CardContent>
    </Card>
  );
}
