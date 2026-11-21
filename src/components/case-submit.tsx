"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CASE_TX = "0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7";

type Summary = {
  ok: boolean;
  error?: string;
  summary?: { caseId: string; argumentSha256: string; expectedDecision: string; attestationUid: string; contractSourceSha256: string; outerSelector?: string; paramTypes?: string; sdkVersion?: string };
  receipt?: Record<string, string>;
};

type Verify = { ok: boolean; error?: string; checks?: Record<string, { ok: boolean; actual?: string; expected: string }> };

export function CaseSubmit() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [verify, setVerify] = useState<Verify | null>(null);
  const [address, setAddress] = useState("0x37383a73306B8F31d9158C3419C29EED856cc1Bc");
  const [note, setNote] = useState("这一页只读。不会再发送案件交易。");
  const [readback, setReadback] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    void fetch("/api/case-call", { signal: controller.signal })
      .then((response) => response.json())
      .then((body: Summary) => setSummary(body))
      .catch((error: unknown) =>
        setSummary({
          ok: false,
          error:
            error instanceof DOMException && error.name === "AbortError"
              ? "读取冻结案件超过 8 秒。没有发送。"
              : error instanceof Error
                ? error.message
                : "读取冻结案件失败",
        }),
      )
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  async function verifyChain() {
    setVerify(null);
    const response = await fetch("/api/arkhai/verify");
    setVerify((await response.json()) as Verify);
  }

  async function submitOnce() {
    setNote(`案件交易 ${CASE_TX} 已经写入。这一页只读，不会再发送。`);
    return;
  }

  async function readBack() {
    const response = await fetch("/api/chain-record");
    const body = (await response.json()) as {
      ok: boolean;
      error?: string;
      records?: { record: { decision?: string; violations?: string[]; evidenceIds?: string[] } | null }[];
      transaction?: { status?: string | null; executionResults?: string[] };
    };
    if (!body.ok) {
      setReadback(body.error || "链上读取失败。没有把执行成功写成判断。");
      return;
    }
    const record = body.records?.[0]?.record;
    setReadback(
      `交易 ${body.transaction?.status ?? "无"} · execution_result ${(body.transaction?.executionResults ?? []).join("/") || "无"} · get_record decision ${record?.decision ?? "无"} · violations ${(record?.violations ?? []).join(",") || "无"} · evidence ${(record?.evidenceIds ?? []).join(",") || "无"}。执行成功不等于判断。`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
          提交这一次第三方案件
          <Badge variant="outline">预期 escalate</Badge>
          <Badge variant="secondary">第三方</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          部署源码保持 {summary?.summary?.contractSourceSha256 ?? "4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e"}。
          输入没有测试日志。一次 review_case 应读回 escalate，不能为了 continue 补日志。
        </p>
        <p className="break-all font-mono text-xs">
          案件 {summary?.summary?.caseId} · 参数 SHA256 {summary?.summary?.argumentSha256}
        </p>
        <p className="break-all font-mono text-xs">
          genlayer-js {summary?.summary?.sdkVersion ?? "1.1.8"} · {summary?.summary?.paramTypes ?? "address,address,uint256,uint256,bytes"} · selector {summary?.summary?.outerSelector ?? "0x27241a99"}
        </p>
        <p className="break-all font-mono text-xs">attestation {summary?.summary?.attestationUid}</p>
        <p>tests-repo {summary?.receipt?.["tests-repo"]}</p>
        <p>tests-commit {summary?.receipt?.["tests-commit"]}</p>
        <p>solution-repo {summary?.receipt?.["solution-repo"]}</p>
        <p>solution-commit {summary?.receipt?.["solution-commit"]}</p>
        <p className="font-mono text-xs">testResult null · 预期 escalate / missing-test-result</p>
        <p className="break-all font-mono text-xs">
          已部署合约 0x37383a73306B8F31d9158C3419C29EED856cc1Bc · review_case calldata SHA256 64db1e58b5d92a15c3565acc4534fdb1fe1ced1d5577b53a082ae10febd84005 · 2596 字节 · selector 0x27241a99
        </p>
        <Button variant="outline" onClick={() => void verifyChain()}>只读核对 Base Sepolia</Button>
        {verify ? (
          <p>
            {verify.ok ? "链、合约 schema、attestation、refUID、两份 commit 与冻结输入一致。" : verify.error || "有字段和冻结输入不一致。"}
          </p>
        ) : null}
        <label className="block">
          已部署的 GitEscrowCourt 地址
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value.trim())}
            placeholder="等父级送回地址后再填，0x 加 40 位"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </label>
        <Button variant="destructive" disabled onClick={() => void submitOnce()}>
          已写入，禁止再次提交
        </Button>
        <p>{note}</p>
        <p className="break-all font-mono text-xs">已写入 {CASE_TX}</p>
        <Button variant="outline" onClick={() => void readBack()}>只读核验这笔案件交易</Button>
        {readback ? <p>{readback}</p> : null}
      </CardContent>
    </Card>
  );
}
