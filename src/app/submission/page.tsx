export default function SubmissionPage() {
  return (
    <div className="space-y-8 text-base leading-7">
      <div>
        <h1 className="text-4xl">申报准备，不是已提交</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Mission 101 截止 2026-11-30。builder-wg 身份在本轮开始时仍未同步。这里不声称资格已经成立，也不声称材料已经送出。
        </p>
      </div>
      <section>
        <h2 className="text-2xl">已经做完</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>独立仓库里的单一闭环：Arkhai 形态的 git-escrow 收据和同一案件的测试结果，冻结后由新的 GenLayer 合约读回判断。</li>
          <li>可运行界面，记录档和只读链上分开。</li>
          <li>可复制的 skill，以及一组本地命令。</li>
          <li>官方 genvm-lint、direct tests，以及在本机能跑通时的 GLSim integration。</li>
          <li>未签名的 Studionet 预览。value 为 0，费用授权不超过 0.001 测试 GEN。</li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl">还没有做，也不能写成已经做了</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>没有调用 api.internetcourt.org，没有官方托管 case id。</li>
          <li>没有用持有者密钥签名，没有 Studionet 部署交易哈希。</li>
          <li>没有 Sepolia 或 Base Sepolia 的 git-escrow 公开回执。被引用的地址没有合约代码。</li>
          <li>没有改 Witnessboard、ReleaseProof、原站、DNS、旧贡献或旧合约。0xd76aa609ae29461303aBDae59974FbC7aAbC27A7 只出现在旧证据的只读说明里。</li>
          <li>没有重复申报旧成果，也没有把别人的改动说成这次交付。夹具是本仓库自己的 add 测试。</li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl">角色</h2>
        <p className="mt-3">
          任务允许申请者本人不是 partner。Arkhai 出现在 Internet Court 公开成员标识里。最终 builder-wg 身份如果仍未同步，申报前要由父级自己确认，本仓库不会补一份资格证明。
        </p>
      </section>
    </div>
  );
}
