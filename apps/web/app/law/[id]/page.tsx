import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

interface NodeRow {
  id: string;
  name: string;
  type: string;
  content: string | null;
  description: string | null;
  metadata: string | null;
  status: string | null;
  number: string | null;
  year: number | null;
  zh_title: string | null;
  zh_summary: string | null;
}

interface EdgeRow {
  relation_type: string;
  other_id: string;
  other_name: string;
  other_status: string | null;
  other_zh_title: string | null;
  direction: "out" | "in";
}

interface ArticleRow {
  id: string;
  name: string;
  content: string | null;
  metadata: string | null;
}

const OUT_LABELS: Record<string, string> = {
  AMENDS: "本法修订的法规",
  REPEALS: "本法废止的法规",
  IMPLEMENTS: "本法实施的上位法",
  REVIEWS: "本法司法审查的对象",
  REFERENCES: "本法引用的法规",
};
const IN_LABELS: Record<string, string> = {
  AMENDS: "修订本法的法规",
  REPEALS: "废止本法的法规",
  IMPLEMENTS: "实施本法的下位法",
  REVIEWS: "审查本法的判决",
  REFERENCES: "引用本法的法规",
};

export default async function LawPage({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = params.id;

  const node = await db
    .prepare("SELECT * FROM nodes WHERE id = ?")
    .bind(id)
    .first<NodeRow>();
  if (!node) notFound();

  const [edgesRes, articlesRes] = await db.batch([
    db
      .prepare(
        `SELECT e.relation_type, e.target_id AS other_id, n.name AS other_name,
                n.status AS other_status, n.zh_title AS other_zh_title, 'out' AS direction
         FROM edges e JOIN nodes n ON n.id = e.target_id
         WHERE e.source_id = ?
         UNION ALL
         SELECT e.relation_type, e.source_id AS other_id, n.name AS other_name,
                n.status AS other_status, n.zh_title AS other_zh_title, 'in' AS direction
         FROM edges e JOIN nodes n ON n.id = e.source_id
         WHERE e.target_id = ?`
      )
      .bind(id, id),
    db
      .prepare(
        `SELECT id, name, content, metadata FROM nodes
         WHERE type = 'ARTICLE' AND id LIKE ? ESCAPE '\\'
         ORDER BY CAST(json_extract(metadata, '$.sort_order') AS INTEGER)`
      )
      .bind(id.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_") + "\\_pasal\\_%"),
  ]);

  const edges = (edgesRes.results ?? []) as unknown as EdgeRow[];
  const articles = (articlesRes.results ?? []) as unknown as ArticleRow[];

  // 分组关系：先按 direction 再按 relation_type
  const groups: { label: string; rows: EdgeRow[] }[] = [];
  for (const direction of ["out", "in"] as const) {
    const labels = direction === "out" ? OUT_LABELS : IN_LABELS;
    for (const [rel, label] of Object.entries(labels)) {
      const rows = edges.filter((e) => e.direction === direction && e.relation_type === rel);
      if (rows.length) groups.push({ label, rows });
    }
  }

  // 条款按 BAB 分组
  const babGroups: { babLabel: string | null; items: { a: ArticleRow; flagged: boolean }[] }[] = [];
  for (const a of articles) {
    let babLabel: string | null = null;
    let flagged = false;
    try {
      const meta = a.metadata ? JSON.parse(a.metadata) : {};
      if (meta.bab) babLabel = `BAB ${meta.bab}${meta.bab_heading ? " — " + meta.bab_heading : ""}`;
      if (meta.content_source) flagged = true; // 官方 PDF 回填的原始条文
    } catch {
      /* ignore */
    }
    const last = babGroups[babGroups.length - 1];
    if (last && last.babLabel === babLabel) last.items.push({ a, flagged });
    else babGroups.push({ babLabel, items: [{ a, flagged }] });
  }

  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href="/" className="text-accent hover:underline">
          ← 返回首页
        </Link>
      </p>

      <header className="mb-8 border border-zinc-200 bg-white p-6">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-zinc-900">
            {node.zh_title ?? node.name}
          </h1>
          <StatusBadge status={node.status} />
        </div>
        <p className="text-sm text-zinc-600">{node.name}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {node.type}
          {node.number ? ` No. ${node.number}` : ""}
          {node.year ? ` · ${node.year} 年` : ""}
        </p>
        {node.zh_summary && (
          <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-6 text-zinc-700">
            {node.zh_summary}
          </p>
        )}
      </header>

      {groups.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">修订与引用关系</h2>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.label} className="border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900">
                  {g.label}
                  <span className="ml-2 text-xs font-normal text-zinc-500">{g.rows.length} 部</span>
                </div>
                <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto">
                  {g.rows.map((r) => (
                    <li key={`${r.direction}-${r.other_id}`}>
                      <Link
                        href={`/law/${r.other_id}`}
                        className="flex items-start justify-between gap-3 px-4 py-2 hover:bg-zinc-50"
                      >
                        <span className="min-w-0 text-sm text-zinc-800">
                          {r.other_zh_title && (
                            <span className="mr-1.5 text-accent">{r.other_zh_title}</span>
                          )}
                          <span className="text-zinc-600">{r.other_name}</span>
                        </span>
                        <span className="shrink-0 pt-0.5">
                          <StatusBadge status={r.other_status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">
          条款原文（印尼语）
          <span className="ml-2 text-sm font-normal text-zinc-500">{articles.length} 条</span>
        </h2>
        {articles.length === 0 ? (
          <p className="text-sm text-zinc-500">
            该法规暂无常设条款文本（可能是关联占位条目或未收录正文）。
          </p>
        ) : (
          <div className="space-y-4">
            {babGroups.map((g, gi) => (
              <div key={gi}>
                {g.babLabel && (
                  <h3 className="mb-2 mt-6 text-sm font-semibold text-zinc-900">{g.babLabel}</h3>
                )}
                <div className="space-y-3">
                  {g.items.map(({ a, flagged }) => (
                    <article key={a.id} className="border border-zinc-200 bg-white p-4">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <h4 className="text-sm font-medium text-accent">{a.name}</h4>
                        {flagged && (
                          <span className="shrink-0 text-xs text-zinc-400">
                            原始条文·本法已修订
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-zinc-800">
                        {a.content}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
