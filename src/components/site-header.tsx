import Link from "next/link";

const links = [
  { href: "/", label: "记录档复核" },
  { href: "/public", label: "公共回执" },
  { href: "/live", label: "只读链上" },
  { href: "/wallet", label: "部署与读回" },
  { href: "/submission", label: "申报边界" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Git escrow court</p>
          <p className="font-serif text-2xl text-foreground">同一案件的交付复核</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
