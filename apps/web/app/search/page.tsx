import Link from "next/link";
import { getDb, likePattern } from "@/lib/db";
import { semanticSearch } from "@/lib/semantic";
import SearchBox from "@/components/SearchBox";
import StatusBadge from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

interface SearchRow {
  id: string;
  name: string;
  type: string;
  status: string | null;
  number: string | null;
  year: number | null;
  zh_title: string | null;
  zh_summary: string | null;
  snippet: string | null;
  law_id: string | null;
}

async function search(q: string): Promise<SearchRow[]> {
  const db = getDb();
  const p = likePattern(q);
  const { results } = await db
    .prepare(
      `SELECT id, name, type, status, number, year, zh_title, zh_summary,
              substr(content, 1, 160) AS snippet,
              json_extract(metadata, '$.law_id') AS law_id
       FROM nodes
       WHERE zh_title LIKE ?1 ESCAPE '\\'
          OR zh_summary LIKE ?1 ESCAPE '\\'
          OR name LIKE ?1 ESCAPE '\\'
          OR content LIKE ?1 ESCAPE '\\'
       ORDER BY CASE WHEN type = 'ARTICLE' THEN 1 ELSE 0 END, year DESC
       LIMIT 50`
    )
    .bind(p)
    .all<SearchRow>();
  return results ?? [];
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const results = q ? await search(q) : [];
  // 语义检索失败时静默降级为空数组，页面只显示精确匹配区
  const semantic = q ? await semanticSearch(q) : [];

  const exactIds = new Set(results.map((r) => r.id));
  const semanticFiltered = semantic.filter((h) => !exactIds.has(h.nodeId));

  return (
    <div>
      <div className="mb-6">
        <SearchBox defaultValue={q} />
      </div>

      {q && (
        <p className="mb-4 text-sm text-zinc-600">
          “{q}” 的搜索结果：精确匹配 {results.length} 条
          {results.length >= 50 ? "（仅显示前 50 条）" : ""}
          {semanticFiltered.length > 0 ? `，语义相关 ${semanticFiltered.length} 条` : ""}
        </p>
      )}

      {!q ? (
        <p className="text-sm text-zinc-500">请输入关键词开始搜索，支持中文自然语言与印尼语。</p>
      ) : (
        <>
          {results.length === 0 ? (
            <p className="mb-8 text-sm text-zinc-500">精确匹配无结果。</p>
          ) : (
            <section className="mb-8">
              <h2 className="mb-3 text-base font-semibold text-zinc-900">精确匹配</h2>
              <ul className="space-y-3">
                {results.map((r) => {
                  const href = r.type === "ARTICLE" && r.law_id ? `/law/${r.law_id}` : `/law/${r.id}`;
                  return (
                    <li key={r.id} className="border border-zinc-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={href} className="text-sm font-medium text-accent hover:underline">
                            {r.type === "ARTICLE" ? r.name : r.zh_title ?? r.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {r.type === "ARTICLE" ? "条款" : `${r.type}${r.number ? ` No. ${r.number}` : ""}${r.year ? `/${r.year}` : ""}`}
                            {" · "}
                            {r.name}
                          </p>
                        </div>
                        <span className="shrink-0">
                          <StatusBadge status={r.status} />
                        </span>
                      </div>
                      {(r.zh_summary || r.snippet) && (
                        <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-zinc-700">
                          {r.zh_summary ?? r.snippet}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {semanticFiltered.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-zinc-900">
                语义相关结果（AI 匹配）
              </h2>
              <ul className="space-y-3">
                {semanticFiltered.map((h) => (
                  <li key={h.nodeId} className="border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/law/${h.lawId}`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          {h.lawZhTitle ? `${h.lawZhTitle} · ` : ""}
                          {h.pasalName}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{h.lawName}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-zinc-400">
                          相似度 {h.score.toFixed(2)}
                        </span>
                        <StatusBadge status={h.lawStatus} />
                      </span>
                    </div>
                    {h.snippet && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-zinc-700">
                        {h.snippet}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.length === 0 && semanticFiltered.length === 0 && (
            <p className="text-sm text-zinc-500">未找到匹配结果，请换用其他关键词（可尝试印尼语术语）。</p>
          )}
        </>
      )}
    </div>
  );
}
