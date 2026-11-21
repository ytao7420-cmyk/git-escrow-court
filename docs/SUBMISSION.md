# Mission 101 提交准备

截止：2026-11-30。

这份文档区分已经完成和尚未完成。它不是提交回执。builder-wg 身份在实现开始时没有同步，这里不伪造资格，也不写“已经提交”。

申请者本人不需要是 partner。Arkhai 的标识出现在 Internet Court 公开页面 `https://internetcourt.org/partners/arkhai.svg`。本仓库使用的是 Arkhai 公开的 make-git-escrow / fulfill-git-escrow 字段，不是 GitHub 作为 partner。

## 这一轮新增的闭环

1. 本仓库自己的 `fixtures/bounty-tests` 和四个解决方案。测试提交和方案提交是临时 git 仓库里钉死日期后算出的真实 commit。
2. `node --test` 实际跑这些文件。通过和失败的退出码进入同一案件的 `testResult`。
3. 收据保留 `tests-repo`、`tests-commit`、`solution-repo`、`solution-commit`、`escrow-uid`、`fulfillment-uid`，并带上官方 schema 字符串 `string commitHash,uint8 commitAlgo,string[] hosts` 和 `(string testsCommitHash, uint8 testsCommitAlgo, string[] hosts)`。
4. mandate、rubric、收据加测试结果被 sha256 冻结。
5. `contracts/git_escrow_court.py` 重算这些哈希，读回 `continue` / `warn` / `constrain` / `revoke` / `escalate`，并给出对应的 `active` / `warned` / `constrained` / `revoked` / `escalated`、证据引用、理由和限制。

TRUE、FALSE、UNDETERMINED 不能作为这个合约的决定。调用方如果预填它们，写入会被拒绝。

## 已完成

- 工作界面：`npm run dev`，端口 43123。记录档和只读链上分成两个页面。
- 可安装 skill：`skill/SKILL.md`，README 里有一组命令。
- `genvm-lint check`、direct tests、本地 Hardhat 上的 schema 镜像、node 对冻结文件的检查。
- GLSim 集成测试由 `python3 scripts/run_integration.py` 启动。日志在跑完后放在 `artifacts/logs/`。如果某次环境起不来，以日志里的具体错误为准，不把 direct 结果说成共识结果。
- 未签名钱包页：Studionet 61999，from `0xcd1dabf73cc80edee8ba664c34a5d636b6e407f9`，value 0，费用授权不超过 0.001 测试 GEN。不调用 `eth_sendTransaction`。
- 35 秒本地录屏 `artifacts/demo/git-escrow-court-demo.mp4` 被父级 videoReview 判为不合格：开头约 6 秒视口被裁切，GenLayer 与 Arkhai 标识被看成水平压缩，钱包页停留太短且标题不清。标识已按 viewBox 重算并在 1280 宽视口量过（误差低于 2%）。钱包页标题改为「在 Studionet 61999 部署 GitEscrowCourt」。在有公共部署交易证据之前不重录。

## 公共 Arkhai 只读

Base Sepolia 官方 `CommitObligation` `0x03d2591DfDf75611AdE94A9a80af61F9BcBfc4e2` 的 schema `string commitHash,uint8 commitAlgo,string[] hosts` 扫到 19 张 attestation，19 张都能从 `refUID` 解出托管 demand 里的 tests-repo 和 tests-commit。例如 fulfillment `0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b`，交易 `0x41758082c771de433f040ddaa216aba688582b761c9f195f1e54a74f4385e133`，solution `https://github.com/mlegls/git-escrow-bun-test-fulfillment.git` @ `164d6a980a19955e9e712f6824951c8d30256091`，tests `https://github.com/mlegls/git-escrow-bun-test-demand.git` @ `3680b366c331d145a1bbfd98fc89bb5d0e0225cb`，oracle `0x84Fa6d4087B267e2D1B158Ffa277338Da725746b`。这些是第三方记录。Ethereum Sepolia 的同一 CommitObligation schema 在部署块到最新块没有 attestation。送进本地合约后的判断是 `escalate`，因为回执里没有测试日志，不能写成测试已通过。

部署交易 `0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f` 已在 Studionet 读回：status `FINALIZED`，consensus `MAJORITY_AGREE`，leader 与 validator 的 `execution_result` 都是 `SUCCESS`。合约地址 `0x37383a73306B8F31d9158C3419C29EED856cc1Bc`。`get_owner` 是父级账户，`list_cases` 是空。MetaMask Confirmed 不是这份 GenVM 结果。源码 SHA256 仍是 `4bd50473ac9a0a0639ad051a1fa3687d025d1e4588913b2dff66cafbcc57758e`。同一案件的 review_case 外层仍是五参 selector `0x27241a99`，calldata SHA256 `64db1e58b5d92a15c3565acc4534fdb1fe1ced1d5577b53a082ae10febd84005`，预期 escalate。不重新部署。`eth_estimateGas` 曾返回 `0x7a120`，gas price 为 0。父级按下「请 MetaMask 签名部署」才会 `eth_sendTransaction`。

上一份运行包 `git-escrow-court-runtime.tar.gz`（SHA256 `74668f746b8595c886fa427cec205fd9989c4613d5581d31bd86461fb7b5aea7`）里，部署按钮先把状态写成「正在读取未签名 payload。还没有请求钱包。」并禁用自己，然后无超时地 `await fetch("/api/deploy-payload")`。解压后的上一份 `./start.sh` 上，这个接口返回 200 和完整 payload；卡住的是按钮在读取返回之前不会进入 `finally`。新包上同一读取约 11 毫秒。页面上的「目标」当时是一段说明，不是 `to`。新包 `git-escrow-court-runtime-v2.tar.gz`（SHA256 `fa8bde1b745fc3a9cc244e76b39a0cc5bd0004f077f938154bb9d4f70e04d1b6`）在按下按钮前就把 to、selector、dataBytes、sourceSHA、value、chain、maxFee 写进页面。核对接口超过 8 秒会停下来并说明原因，不因此关掉按钮。钱包请求分别有 15 秒或 60 秒上限，超时后按钮恢复。没有交易哈希就不算部署成功。用新目录替换本机 runtime，不要覆盖正在跑的旧目录。

有人把「必须有官方托管案号」说成 Mission 规则。这里没有把那句话当成已经核实的门槛。原任务要求的是可复现的真实 partner 集成、测试网交易和读回。`api.internetcourt.org` 仍然不调用，也不伪造 case id。

## 未完成

- 没有官方托管 case id。没有调用 `api.internetcourt.org`。自主部署或本地 VM 不等于托管法庭。
- 没有父级签名，因此没有新的 Studionet 部署交易。
- GLSim 在部署之后的 `gen_getContractSchemaForCode` 会返回空的方法表。集成测试改走 GenLayer client 的 `write_contract` / `read_contract`，并用 `tx_execution_succeeded` 确认执行成功。这不是托管网络上的部署。
- 没有 Arkhai 公共测试网回执。不能写“预言机已实测仲裁”。
- `0xc5c132B69f57dAAAb75d9ebA86cab504b272Ccbc` 在 Ethereum Sepolia 上 `eth_getCode` 为 `0x`。官方部署文件把它记为 deployer，skill 文本把它称为 public demo oracle。两者同时成立，不能再把它说成一个有代码的在线合约。
- Studio-dev 61997 是另一条链。只读余额不能当成 Studionet 的 10 GEN。
- 任何测试代币授权都还没组装。将来如果要授权，金额只能等于夹具里的 `1000000` 个最小单位，不能无限授权。父级要自己核对代币合约。
- ReleaseProof 的公开文件只作为旧溯源，不进入新案件的决定输入：
  - https://github.com/ytao7420-cmyk/releaseproof/blob/main/public/evidence/demo.json
  - https://github.com/ytao7420-cmyk/releaseproof/blob/main/public/evidence/audit-package.json
  - https://github.com/ytao7420-cmyk/releaseproof/blob/main/public/evidence/drift-observation.json
- 旧合约 `0xd76aa609ae29461303aBDae59974FbC7aAbC27A7` 出现在那些公开文件里，只是历史背景。本仓库没有把它当作新部署。
- Witnessboard、原站、DNS、旧贡献和旧合约都没有改。

## 角色和截止

截止仍是 2026-11-30。材料可以准备，资格和实际点击提交要等身份状态由父级确认。本仓库不补一份不存在的 builder-wg 证明。
