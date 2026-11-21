"use client";

import { useEffect, useState } from "react";

import { Marks } from "@/components/marks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const scenarios = [
  { id: "pass", label: "通过 → continue" },
  { id: "warn", label: "缺说明 → warn" },
  { id: "constrain", label: "无限授权 → constrain" },
  { id: "revoke", label: "测试失败 → revoke" },
  { id: "escalate", label: "没有测试结果 → escalate" },
  { id: "tamper", label: "哈希被改" },
  { id: "rename", label: "字段改名" },
  { id: "preset", label: "预填 TRUE" },
  { id: "live-claim", label: "冒充测试网回执" },
  { id: "repeat", label: "重复写入" },
];

type ReviewResponse = {
  ok: boolean;
  mode?: string;
  scenario?: string;
  error?: string;
  record?: {
    caseId: string;
    decision: string;
    mandateStatus: string;
    score: number;
    reasoning: string;
    reasoningSource: string;
    violations: string[];
    evidenceRefs: Array<{ id: string; value?: string; sha256?: string }>;
    limitations: string[];
    reviewedActionIds: string[];
    notUsed: string[];
    repeatRefused?: string;
  };
};

export function Docket() {
  const [scenario, setScenario] = useState("pass");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [transportError, setTransportError] = useState("");

  async function run(next: string) {
    setScenario(next);
    setLoading(true);
    setTransportError("");
    setResult(null);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: next }),
      });
      const body = (await response.json()) as ReviewResponse;
      setResult(body);
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run("pass");
  }, []);

  const record = result?.record;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-700/30 bg-amber-100 px-4 py-3 text-sm text-amber-950">
        <strong>记录档 · 本地夹具。</strong>
        这一页的判断来自本机 GenLayer direct VM，不是公开测试网回执，也不是 Internet Court 托管案件。链上只读状态在「只读链上」。
      </section>
      <Marks />
      <div className="flex flex-wrap gap-2">
        {scenarios.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={scenario === item.id ? "default" : "outline"}
            onClick={() => void run(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm">正在部署本地合约并读回这一份冻结案件。direct VM 只跑 leader，共识路径在集成测试里。</CardContent>
        </Card>
      ) : null}
      {transportError ? (
        <Card>
          <CardHeader>
            <CardTitle>复核请求没有完成</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm text-destructive">{transportError}</CardContent>
        </Card>
      ) : null}
      {result && !result.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>合约拒绝写入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge variant="destructive">没有判断</Badge>
            <p>这次输入没有通过结构检查，所以没有 case 记录，也不能把它读成 continue 或其他状态。</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 font-mono text-xs">{result.error}</pre>
          </CardContent>
        </Card>
      ) : null}
      {record ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                读回的判断
                <Badge>{record.decision}</Badge>
                <Badge variant="secondary">{record.mandateStatus}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{record.reasoning}</p>
              <p className="font-mono text-xs text-muted-foreground">
                分数 {record.score} · 理由来源 {record.reasoningSource} · 案件 {record.caseId}
              </p>
              <div>
                <p className="mb-2 font-medium">证据引用</p>
                <ul className="space-y-1 font-mono text-xs">
                  {record.evidenceRefs.map((ref) => (
                    <li key={ref.id}>
                      {ref.id}: {ref.value || ref.sha256}
                    </li>
                  ))}
                </ul>
              </div>
              {record.violations.length > 0 ? (
                <p>违反项：{record.violations.join(", ")}</p>
              ) : (
                <p>这一份没有违反项。</p>
              )}
              {record.repeatRefused ? (
                <p className="rounded-md bg-secondary p-3 text-xs">第二次写入被拒绝：{record.repeatRefused}</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>限制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="list-disc space-y-2 pl-4">
                {record.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="font-mono text-xs">未使用的预言机市场词：{record.notUsed.join(" / ")}</p>
              <p className="font-mono text-xs">动作：{record.reviewedActionIds.join(" · ")}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>状态怎么对应</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto text-sm">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-3">法庭决定</th>
                <th className="py-2 pr-3">委托状态</th>
                <th className="py-2">含义</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["continue", "active", "测试通过，证据和冻结哈希一致"],
                ["warn", "warned", "测试通过，但缺少说明"],
                ["constrain", "constrained", "测试通过，但出现无限授权"],
                ["revoke", "revoked", "测试失败，或证据哈希对不上"],
                ["escalate", "escalated", "收据在，测试结果不在或对不上同一案件"],
              ].map((row) => (
                <tr key={row[0]} className="border-b border-border/70">
                  <td className="py-2 pr-3 font-mono">{row[0]}</td>
                  <td className="py-2 pr-3 font-mono">{row[1]}</td>
                  <td className="py-2">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-muted-foreground">
            TRUE、FALSE、UNDETERMINED 属于另一套二元预言机词汇。它们不能写入这个合约的 decision。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
