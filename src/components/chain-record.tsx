"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readResponseJson } from "@/lib/read-response";

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
type LiveTx = {
  caseId: string;
  hash: string;
  frozenIdentifier?: boolean;
  note?: string;
  verified?: boolean;
  executionOk?: boolean;
  error?: string;
  transaction?: { status?: string | null; resultName?: string | null; executionResults?: string[]; hash?: string } | null;
};

type Payload = {
  ok: boolean;
  error?: string;
  source?: string;
  contract?: string;
  owner?: string;
  caseIds?: string[];
  records?: { caseId: string; raw: string; record: Stored | null }[];
  reads?: LiveTx[];
};

export function ChainRecord() {
  const [body, setBody] = useState<Payload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    void fetch("/api/chain-record", { signal: controller.signal })
      .then(async (response) => {
        const parsed = await readResponseJson(response);
        if (!parsed.ok) return { ok: false, error: parsed.error } satisfies Payload;
        return parsed.value as Payload;
      })
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

  const records = body?.records ?? [];

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
            {records.length === 0 ? <p>list_cases 没有返回可解析的案件。没有把预期判断写进来。</p> : null}
            {records.map((item) => {
              const live = body.reads?.find((read) => read.caseId === item.caseId);
              const record = item.record;
              return (
                <div key={item.caseId} className="space-y-2 rounded-md border border-border p-3">
                  <p className="break-all font-mono text-xs">case {item.caseId}</p>
                  {live ? (
                    <>
                      <p className="break-all font-mono text-xs">冻结哈希 {live.hash}</p>
                      <p>{live.note}</p>
                      {live.verified && live.transaction ? (
                        <p>
                          本次 RPC {live.transaction.status ?? "无"} · {live.transaction.resultName ?? "无"} · execution_result {(live.transaction.executionResults ?? []).join(" / ") || "无"}
                          {live.executionOk ? "。执行成功仍不是判断。" : "。这次执行结果不能写成判断。"}
                        </p>
                      ) : (
                        <p>{live.error || "这次 RPC 没有核验该交易。冻结哈希不能代替终局。"}</p>
                      )}
                    </>
                  ) : (
                    <p>这笔案件没有预先登记的交易哈希。没有把另一笔交易借来显示。</p>
                  )}
                  {record ? (
                    <>
                      <p>
                        get_record decision {record.decision ?? "无"} · mandateStatus {record.mandateStatus ?? "无"} · violations {(record.violations ?? []).join(", ") || "无"}
                      </p>
                      <p>reasoningSource {record.reasoningSource ?? "无"}</p>
                      <p>{record.reasoning}</p>
                    </>
                  ) : (
                    <p>get_record 没有解析出记录。没有用预期判断填上。</p>
                  )}
                </div>
              );
            })}
            <p>缺测试日志时的 escalate 表示证据不够结算，不表示测试已经通过，也不是 LLM 判决。本项目没有创建托管 escrow，也没有官方托管案号。</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
