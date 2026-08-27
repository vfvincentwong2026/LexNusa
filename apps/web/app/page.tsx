import Link from "next/link";
import { getDb, LawNode } from "@/lib/db";
import SearchBox from "@/components/SearchBox";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const DOMAIN_ORDER = ["公司与投资", "劳工", "税务", "移民", "土地", "行业监管"];

async function getCoreLaws(): Promise<Record<string, LawNode[]>> {
  try {
    const db = getDb();
    const { results } = await db
      .prepare(
        `SELECT id, name, type, status, number, year, zh_title, zh_summary,
                json_extract(metadata, '$.domain') AS domain
         FROM nodes
         WHERE zh_title IS NOT NULL
         ORDER BY domain, year DESC`
      )
      .all<LawNode>();
    const grouped: Record<string, LawNode[]> = {};
    for (const row of results ?? []) {
      const d = row.domain ?? "其他";
      (grouped[d] ||= []).push(row);
    }
    return grouped;
  } catch {
    return {};
  }
}

export default async function HomePage() {
  const grouped = await getCoreLaws();
  const domains = [
    ...DOMAIN_ORDER.filter((d) => grouped[d]),
    ...Object.keys(grouped).filter((d) => !DOMAIN_ORDER.includes(d)),
  ];

  return (
    <div>
      <section className="mb-10 border border-zinc-200 bg-white p-8">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
          中文检索印尼法规
        </h1>
        <p className="mb-6 text-sm text-zinc-600">
          面向中国出海企业：法规搜索、条款原文阅读、修订状态标注。
        </p>
        <SearchBox autoFocus />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">核心法规浏览</h2>
        {domains.length === 0 ? (
          <p className="text-sm text-zinc-500">
            本地数据库尚未初始化，请先运行数据同步与 seed（见仓库 README）。
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {domains.map((domain) => (
              <div key={domain} className="border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-900">
                  {domain}
                </div>
                <ul className="divide-y divide-zinc-100">
                  {grouped[domain].map((law) => (
                    <li key={law.id}>
                      <Link
                        href={`/law/${law.id}`}
                        className="flex items-start justify-between gap-3 px-4 py-2.5 hover:bg-zinc-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-zinc-900">
                            {law.zh_title}
                          </span>
                          <span className="block truncate text-xs text-zinc-500">
                            {law.type} No. {law.number}/{law.year} · {law.name}
                          </span>
                        </span>
                        <span className="shrink-0 pt-0.5">
                          <StatusBadge status={law.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
