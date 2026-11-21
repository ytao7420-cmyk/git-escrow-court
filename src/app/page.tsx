import { Docket } from "@/components/docket";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl leading-tight">把一份 git-escrow 交付交给同一份复核</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          夹具里的测试仓库、测试提交、解决方案和真实 node:test 日志先冻成 mandate、rubric 和证据哈希，再由新的
          GenLayer 合约读回带证据引用的判断。字段名保持 tests-repo 和 tests-commit。
        </p>
      </div>
      <Docket />
    </div>
  );
}
