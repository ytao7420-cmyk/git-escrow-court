"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readResponseJson } from "@/lib/read-response";

const CASE_TX = "0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7";

export function CaseSubmit() {
  const [address, setAddress] = useState("0x37383a73306B8F31d9158C3419C29EED856cc1Bc");
  const [note, setNote] = useState("这一页只读。不会再发送案件交易。");
  const [readback, setReadback] = useState("");

  async function submitOnce() {
    setNote(`历史案件交易 ${CASE_TX} 已经写入。这一页只读，不会再发送。`);
    return;
  }

  async function readBack() {
    const response = await fetch("/api/chain-record");
    const parsed = await readResponseJson(response);
    if (!parsed.ok) {
      setReadback(parsed.error);
      return;
    }
    const body = parsed.value as {
      ok?: boolean;
      error?: string;
      reads?: { caseId?: string; hash?: string; verified?: boolean; transaction?: { status?: string | null; executionResults?: string[] } | null }[];
      records?: { caseId: string; record: { decision?: string; violations?: string[] } | null }[];
    };
    if (!body.ok) {
      setReadback(body.error || "链上读取失败。没有把执行成功写成判断。");
      return;
    }
    const lines = (body.reads ?? []).map((item) => {
      const record = body.records?.find((entry) => entry.caseId === item.caseId)?.record;
      if (!item.verified || !item.transaction) return `${item.caseId} 冻结哈希 ${item.hash} 这次没有核验。`;
      return `${item.caseId} ${item.transaction.status ?? "无"} execution ${(item.transaction.executionResults ?? []).join("/") || "无"} get_record ${record?.decision ?? "无"}/${(record?.violations ?? []).join(",") || "无"}`;
    });
    setReadback(lines.join(" ") || "没有可读的案件交易。");
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
          下面这些字段是冻结的第三方案件说明，不是这次打开页面时从链上读到的。部署源码保持 4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e。
          输入没有测试日志。一次 review_case 应读回 escalate，不能为了 continue 补日志。
        </p>
        <p className="break-all font-mono text-xs">冻结案件 public-0726369d528e</p>
        <p className="font-mono text-xs">testResult null · 预期 escalate / missing-test-result</p>
        <p className="break-all font-mono text-xs">
          已部署合约 0x37383a73306B8F31d9158C3419C29EED856cc1Bc · review_case calldata SHA256 64db1e58b5d92a15c3565acc4534fdb1fe1ced1d5577b53a082ae10febd84005 · 2596 字节 · selector 0x27241a99
        </p>
        <p>公开站点不调用 /api/case-call 或 /api/arkhai/verify。那些接口不在当前允许的只读名单里，空响应也不能解析成成功。</p>
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
        <p className="break-all font-mono text-xs">历史冻结哈希 {CASE_TX}。新的复现案件在上方只读记录里核验，这一张卡片不能再发送它。</p>
        <Button variant="outline" onClick={() => void readBack()}>只读核验这笔案件交易</Button>
        {readback ? <p>{readback}</p> : null}
      </CardContent>
    </Card>
  );
}
