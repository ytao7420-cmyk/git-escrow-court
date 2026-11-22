export default function SubmissionPage() {
  return (
    <div className="space-y-8 text-base leading-7">
      <div>
        <h1 className="text-4xl">申报准备，不是已提交</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          当前准备的是普通 Projects 41，不依赖 builder-wg。专项 Mission 101 仍要等资格确认，这一页不声称 101 已经获资格，也不声称 Portal 已提交、GLP 或 Accepted。
        </p>
      </div>
      <section>
        <h2 className="text-2xl">已经做完</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>独立仓库里的单一闭环：Arkhai 形态的 git-escrow 收据和同一案件的测试结果，冻结后由新的 GenLayer 合约读回判断。</li>
          <li>可运行界面，记录档和只读链上分开。</li>
          <li>可复制的 skill，以及一组本地命令。</li>
          <li>官方 genvm-lint、direct tests，以及在本机能跑通时的 GLSim integration。</li>
          <li>Studionet 61999 部署交易 0x3245ee1f95c3aad8529a0732b105be5d43fc52c6c726807a18c24241b4d3d76f 已终局，合约 0x37383a73306B8F31d9158C3419C29EED856cc1Bc。案件交易 0xf95e4d26e5cb3aaa836b0e3632c606da0f4e476d3fb98c6844fbea73818e1fc7 写入 public-0726369d528e。get_record 是 escalate、escalated、missing-test-result、deterministic-rubric。这是合约规则，不是 LLM 判决，也不是测试已经通过。</li>
          <li>部署按钮和案件提交按钮保持关闭。页面只读已有交易，不再发送。</li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl">还没有做，也不能写成已经做了</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>公开只读演示是 https://git-escrow-court.vercel.app 。127.0.0.1 不是公开网站，不能填进网站栏。</li>
          <li>没有调用 api.internetcourt.org，没有官方托管 case id。Portal 还没有提交。</li>
          <li>另有一笔已写入的复现交易 0xd72bc727c5a0c16bef3326d0f4a18593b22774f4d5f79553447d4bc6aefeea68，案件 repro-237ab1a3788efdecb055ce97ef351eb6。公开页要用当次 RPC 核验终局和 get_record，读失败就是未验证。它不能再发送。</li>
          <li>Base Sepolia attestation 0x0726369d528e02356e76a081a5c164c217cd219f47a7217811530107face2c7b 是第三方记录。这个钱包没有创建那笔托管 escrow。Ethereum Sepolia 上 0xc5c132B69f57dAAAb75d9ebA86cab504b272Ccbc 没有合约代码。</li>
          <li>没有改 Witnessboard、ReleaseProof、原站、DNS、旧贡献或旧合约。0xd76aa609ae29461303aBDae59974FbC7aAbC27A7 只出现在旧证据的只读说明里。</li>
          <li>没有把这份材料写成已经申报成功。本地 pass、warn、revoke 夹具是本仓库自己的 add 测试；链上那一笔用的是上面的第三方回执，而且因为没有测试日志而 escalate。</li>
        </ul>
      </section>
      <section>
        <h2 className="text-2xl">新测试案件复现</h2>
        <p className="mt-3">
          /repro 为每个新标签页生成自己的 caseId，不把已经写入的 repro-237ab1a3788efdecb055ce97ef351eb6 变成另一笔可发送案件。Studionet 61999，value 为 0，发送前核对 0.001 测试 GEN。公开编码 POST /api/repro-case 默认关闭；Hobby 计划没有平台级限速。进程内并发上限只作用于当前实例，不是全局限流。请求体硬上限 32KiB。没有测试日志时的预期仍是 escalate，不是测试通过。
        </p>
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
