"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EvidenceRef = { id?: string; value?: string; sha256?: string };
type Stored = {
  caseId?: string;
  decision?: string;
  mandateStatus?: string;
  reasoning?: string;
  reasoningSource?: string;
  violations?: string[];
  evidenceIds?: string[];
  evidenceRefs?: EvidenceRef[];
  limitations?: string[];
};
type Payload = {
  ok: boolean;
  error?: string;
  source?: string;
  contract?: string;
  owner?: string;
  caseIds?: string[];
  records?: { caseId: string; raw: string; record: Stored | null }[];
  transaction?: { status?: string | null; resultName?: string | null; executionResults?: string[]; hash?: string };
};

export function ChainRecord() {
  const [body, setBody] = useState<Payload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    void fetch("/api/chain-record", { signal: controller.signal })
      .then(async (response) => (await response.json()) as Payload)
      .then(setBody)
      .catch((error: unknown) =>
        setBody({
          ok: false,
          error: error instanceof DOMException && error.name === "AbortError" ? "链上读取超过 15 秒。" : error instanceof Error ? error.message : "链上读取失败",
        }),
      )
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const record = body?.records?.[0]?.record ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
          合约里实际存下的判断
          <Badge variant="outline">Studionet get_record</Badge>
          <Badge variant="secondary">不是本地夹具</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>这些字段来自 {body?.source ?? "https://studio.genlayer.com/api"} 对已部署合约的只读调用。执行成功不等于判断已经是 escalate。</p>
        {!body ? <p>正在读取 list_cases 和 get_record。</p> : null}
        {body && !body.ok ? <p>{body.error}</p> : null}
        {body?.ok ? (
          <>
            <p className="break-all font-mono text-xs">合约 {body.contract}</p>
            <p className="break-all font-mono text-xs">owner {body.owner}</p>
            <p className="break-all font-mono text-xs">list_cases {JSON.stringify(body.caseIds ?? [])}</p>
            <p className="break-all font-mono text-xs">
              案件交易 {body.transaction?.hash} · {body.transaction?.status} · {body.transaction?.resultName} · execution_result {(body.transaction?.executionResults ?? []).join(" / ") || "无"}
            </p>
            {record ? (
              <>
                <p>
                  decision {record.decision ?? "无"} · mandateStatus {record.mandateStatus ?? "无"} · violations {(record.violations ?? []).join(", ") || "无"}
                </p>
                <p>reasoningSource {record.reasoningSource ?? "无"}</p>
                <p>{record.reasoning}</p>
                <ul className="space-y-1">
                  {(record.evidenceRefs ?? []).map((item) => (
                    <li key={item.id} className="break-all font-mono text-xs">
                      {item.id} {item.value ?? item.sha256}
                    </li>
                  ))}
                </ul>
                <p>这张回执是第三方 Base Sepolia attestation，本项目没有创建托管 escrow，也没有官方托管案号。缺测试日志时的 escalate 表示证据不够结算，不表示测试已经通过。</p>
              </>
            ) : (
              <p>list_cases 没有返回可解析的案件。没有把预期判断写进来。</p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
