"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deployRefusal, payloadMismatch, type DeployPayload } from "@/lib/deploy-check";
import evidence from "../../fixtures/public/deploy-result.json";
import { arkhaiApprovalPreview, studioDevWarning } from "@/lib/unsigned";
import { formatProviderError, loadSendState, readyAfterRejection, type SendState } from "@/lib/wallet-transport";

type TxLookup = {
  ok: boolean;
  found?: boolean;
  error?: string;
  status?: string | null;
  resultName?: string | null;
  executionResults?: string[];
  contractAddress?: string | null;
  note?: string;
};

const CHECK_MS = 8000;

export function WalletPanel({ payload }: { payload: DeployPayload }) {
  const localRefusal = deployRefusal(payload);
  const [copied, setCopied] = useState("");
  const [walletNote, setWalletNote] = useState(
    "发送按钮保持关闭。MetaMask 里那笔待确认不要点确认，也不要再从页面发一次。",
  );
  const [checkNote, setCheckNote] = useState("正在用 8 秒超时核对 /api/deploy-payload。这一步不禁用部署按钮。");
  const [remoteBlock, setRemoteBlock] = useState("");
  const [hash, setHash] = useState(evidence.hash);
  const [lookup, setLookup] = useState<TxLookup | null>(null);
  const [sendState, setSendState] = useState<SendState>(readyAfterRejection);

  useEffect(() => {
    setSendState(loadSendState(window.sessionStorage));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_MS);
    fetch("/api/deploy-payload", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { ok?: boolean; error?: string; payload?: DeployPayload };
        if (!response.ok || !body.ok) {
          setRemoteBlock(body.error || `核对接口返回 ${response.status}。拒绝签名。`);
          setCheckNote("接口核对没有通过。部署按钮已停用，原因写在下面。");
          return;
        }
        const mismatch = payloadMismatch(payload, body.payload);
        if (mismatch) {
          setRemoteBlock(mismatch);
          setCheckNote("接口返回的 payload 和页面不一致。拒绝签名。");
          return;
        }
        setRemoteBlock("");
        setCheckNote("本机 /api/deploy-payload 与页面上的 to、selector、data、sourceSHA、value、chain、费用上限一致。");
      })
      .catch((error: unknown) => {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        setCheckNote(
          aborted
            ? "核对 /api/deploy-payload 超过 8 秒，已停止等待。发送按钮保持关闭。"
            : `核对接口失败：${formatProviderError(error)}。发送按钮保持关闭。`,
        );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [payload]);

  async function copyPayload() {
    const copy = {
      to: payload.to,
      selector: payload.selector,
      dataBytes: payload.calldataBytes,
      sourceSHA: payload.sourceSha256,
      value: payload.value,
      chainId: payload.chainId,
      chainIdHex: payload.chainIdHex,
      maxFeeWei: payload.feeCapWei,
      from: payload.from,
      data: payload.data,
    };
    await navigator.clipboard.writeText(JSON.stringify(copy, null, 2));
    setCopied("已复制未签名部署参数，含 to、selector、data、sourceSHA。这一步没有请求钱包。");
  }

  function signDeploy() {
    setWalletNote(`合约已经部署在 ${evidence.contractAddress}。交易 ${evidence.hash} 的 GenVM execution_result 是 SUCCESS。这一页不会再部署。`);
  }

  function addNetwork() {
    setWalletNote("这一步不调用钱包。网络已经在用。不要为了添加网络再发出一笔请求。");
  }

  async function checkHash() {
    setLookup(null);
    try {
      const response = await fetch(`/api/tx?hash=${encodeURIComponent(hash)}`);
      setLookup((await response.json()) as TxLookup);
    } catch (error) {
      setLookup({ ok: false, error: formatProviderError(error) });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-stone-500/30 bg-stone-200 px-4 py-3 text-sm">
        <strong>部署已经完成，禁止再部署。</strong>
        GenVM execution_result 是 {evidence.executionResults.join(" / ")}，状态 {evidence.status} / {evidence.resultName}。合约地址 {evidence.contractAddress}。交易 {evidence.hash}。MetaMask 的 Confirmed 只说明钱包已广播，上面的 execution_result 才是 GenVM 结果。2026-11-21 02:44 的记录不是这一笔。
      </section>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Studionet 部署参数 <Badge variant="outline">value 0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Preview label="to" value={payload.to} />
          <Preview label="sdk" value={`genlayer-js ${payload.sdkVersion} · ABI 输入 ${payload.abiInputCount} · fallback ${payload.fallbackUsed ? "会用" : "不用"}`} />
          <Preview label="paramTypes" value={payload.paramTypes} />
          <Preview label="selector" value={payload.selector} />
          <Preview label="dataBytes" value={String(payload.calldataBytes)} />
          <Preview label="sourceSHA" value={payload.sourceSha256} />
          <Preview label="value" value={payload.value} />
          <Preview label="chain" value={`${payload.chainId} · ${payload.chainIdHex}`} />
          <Preview label="maxFee" value={`${payload.feeCap} · ${payload.feeCapWei} wei`} />
          <Preview label="from" value={payload.from} />
          <Preview label="method" value={payload.method} />
          <p className="text-muted-foreground">{checkNote}</p>
          <p>打开这一页不会请求钱包。gas 估计不能用来证明 ABI。旧请求不再 pending。</p>
          {sendState.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {localRefusal ? <p>{localRefusal}</p> : null}
          {remoteBlock ? <p>{remoteBlock}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void copyPayload()}>
              复制未签名参数
            </Button>
            <Button type="button" variant="outline" onClick={addNetwork}>
              只添加 Studionet 网络
            </Button>
            <Button type="button" variant="destructive" disabled onClick={signDeploy}>
              已部署，禁止再次部署
            </Button>
          </div>
          {copied ? <p>{copied}</p> : null}
          <p>{walletNote}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>不要签到 Studio-dev</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            chainId {studioDevWarning.chainId} · {studioDevWarning.rpc}
          </p>
          <p>{studioDevWarning.note}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Arkhai 测试授权 <Badge variant="destructive">未组装</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {arkhaiApprovalPreview.network} · chainId {arkhaiApprovalPreview.chainId} · value {arkhaiApprovalPreview.value}
          </p>
          <p>代币：{arkhaiApprovalPreview.token}</p>
          <p>金额：{arkhaiApprovalPreview.amount}</p>
          <p>禁止：{arkhaiApprovalPreview.forbidden}</p>
          <p>
            官方 Sepolia CommitObligation：
            <span className="font-mono text-xs">{arkhaiApprovalPreview.commitObligation}</span>
          </p>
          <p>{arkhaiApprovalPreview.note}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>核对一笔已经存在的 Studionet 交易</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <input
            value={hash}
            onChange={(event) => setHash(event.target.value)}
            placeholder="0x 加 64 位十六进制，留空就表示还没有"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={() => void checkHash()}>
            只读查询
          </Button>
          {lookup ? (
            <div className="space-y-1">
              <p>{lookup.ok ? lookup.note ?? (lookup.found ? "已读到交易。" : "没有这笔交易。") : lookup.error}</p>
              {lookup.found ? (
                <>
                  <p>status {lookup.status ?? "无"} · consensus {lookup.resultName ?? "无"}</p>
                  <p>execution_result {(lookup.executionResults ?? []).join(" / ") || "无"}</p>
                  <p className="break-all font-mono text-xs">contract {lookup.contractAddress ?? "无"}</p>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground">查询还没开始。默认哈希是已经部署的那一笔。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}</span>
      <span className="mt-1 block break-all font-mono text-xs">{value}</span>
    </p>
  );
}
