"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runReproLifecycle, type ReproEncode, type ReproResult } from "@/lib/repro-lifecycle";
import {
  createReproCaseId,
  emptyReproGuard,
  loadReproGuard,
  reproClickAllowed,
  saveReproGuard,
  type ReproGuard,
} from "@/lib/repro-shared";
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
};

export function ReproCase() {
  const [description, setDescription] = useState<Description | null>(null);
  const [guard, setGuard] = useState<ReproGuard>(emptyReproGuard());
  const [result, setResult] = useState<ReproResult | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    const loaded = loadReproGuard(window.sessionStorage);
    let next = loaded;
    if (!loaded.caseId && !loaded.locked && !loaded.hash) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      next = { ...loaded, caseId: createReproCaseId(bytes) };
      saveReproGuard(window.sessionStorage, next);
    }
    setGuard(next);
    if (!next.caseId) return;
    const controller = new AbortController();
    void fetch(`/api/repro-case?caseId=${encodeURIComponent(next.caseId)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((body: Description) => setDescription(body))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDescription({ ok: false, error: formatProviderError(error) });
      });
    return () => controller.abort();
  }, []);

  async function confirm() {
    if (sending.current || busy || !reproClickAllowed(guard) || !guard.caseId) return;
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
    if (!description?.ok || !description.consensus || description.caseId !== guard.caseId) {
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
    const caseId = guard.caseId;
    sending.current = true;
    setBusy(true);
    try {
      const next = await runReproLifecycle({
        userConfirmed: true,
        caseId,
        expectedConsensus: description.consensus,
        request: (args) => selected.provider.request(args),
        encode: async (sender) => {
          const response = await fetch("/api/repro-case", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sender, caseId, broadcast: false }),
          });
          return (await response.json()) as ReproEncode;
        },
        probe: async (id) => {
          const response = await fetch("/api/chain-record");
          const body = (await response.json()) as { ok?: boolean; error?: string; caseIds?: unknown };
          if (!response.ok || !body.ok || !Array.isArray(body.caseIds)) {
            return { ok: false as const, error: body.error || "list_cases 没有读到" };
          }
          return { ok: true as const, exists: body.caseIds.includes(id) };
        },
        lookup: async (hash) => {
          const response = await fetch(`/api/tx?hash=${encodeURIComponent(hash)}`);
          return (await response.json()) as GenLayerLookup;
        },
        readback: async (id) => {
          const response = await fetch("/api/chain-record");
          const body = (await response.json()) as {
            ok: boolean;
            error?: string;
            records?: { caseId: string; record: { caseId?: string; decision?: string; mandateStatus?: string; violations?: string[]; reasoningSource?: string } | null }[];
          };
          if (!body.ok) return { ok: false as const, error: body.error || "链上读取失败" };
          const found = body.records?.find((item) => item.caseId === id)?.record;
          if (!found) return { ok: false as const, error: "list_cases 里还没有这个新案件" };
          return { ok: true as const, record: found };
        },
        onBeforeSend: () => {
          const locked: ReproGuard = {
            caseId,
            hash: null,
            locked: true,
            lines: ["已经请求钱包。刷新后按钮保持关闭，避免同一案件再发一次。"],
          };
          saveReproGuard(window.sessionStorage, locked);
          setGuard(locked);
        },
        intervalMs: 3_000,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
      const nextGuard: ReproGuard = {
        caseId,
        hash: next.hash,
        locked: Boolean(next.hash) || !next.allowAnotherSend,
        lines: next.lines,
      };
      saveReproGuard(window.sessionStorage, nextGuard);
      setGuard(nextGuard);
      setResult(next);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const locked = !reproClickAllowed(guard) || busy;

  return (
    <Card>
      <CardHeader>
        <CardTitle>新测试案件，不是旧的终局记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="break-all">
          caseId {guard.caseId ?? "尚未生成"}。旧案件 {description?.historicalCaseId ?? "public-0726369d528e"} 不在这笔交易里。
          合约 {description?.contract ?? "0x37383a73306B8F31d9158C3419C29EED856cc1Bc"}。方法只有 review_case。
        </p>
        <p>
          每个标签页第一次打开时生成自己的案件 id，并在等待、拒绝后的再次点击和刷新时继续用它。链上已经有这个 id 就不会再发。Studionet 61999 是测试网。value 是 0，发送前按 gas 和 gasPrice 核对 0.001 测试 GEN 上限。testResult 是 null，所以预期是 {description?.expectedDecision ?? "escalate"} / missing-test-result。缺日志不是测试通过，也不是 LLM 判决。
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
