import { ReproCase } from "@/components/repro-case";

export default function ReproPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">新测试案件复现</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          服务端渲染只放说明。已终局的部署和 public-0726369d528e 仍在原来的页面，那些按钮继续关闭。这里准备的是另一笔还没有广播的 review_case。
        </p>
      </div>
      <ReproCase />
    </div>
  );
}
