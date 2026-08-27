import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface SemanticHit {
  nodeId: string;
  score: number;
  lawId: string;
  lawZhTitle: string | null;
  lawName: string;
  lawStatus: string | null;
  pasalName: string;
  snippet: string;
}

interface VectorizeMatchLike {
  id: string;
  score: number;
}

/**
 * 中文/印尼语自然语言 -> bge-m3 查询向量 -> Vectorize topK -> D1 回填条款与法规信息。
 * 任何一步失败都静默降级返回 []（页面只显示精确匹配区）。
 */
export async function semanticSearch(q: string, topK = 8): Promise<SemanticHit[]> {
  try {
    const env = getCloudflareContext().env as unknown as CloudflareEnv;

    const aiRes = (await env.AI.run("@cf/baai/bge-m3", { text: [q] })) as {
      data?: number[][];
    };
    const vector = aiRes?.data?.[0];
    if (!Array.isArray(vector) || vector.length === 0) {
      console.error("[semantic] AI.run 返回异常:", JSON.stringify(aiRes).slice(0, 300));
      return [];
    }

    const matches = (await env.VECTORIZE.query(vector, {
      topK,
      returnMetadata: "all",
    })) as { matches?: VectorizeMatchLike[] };
    const hits = matches.matches ?? [];
    if (hits.length === 0) {
      console.error("[semantic] VECTORIZE.query 无命中");
      return [];
    }

    const ids = hits.map((h) => h.id);
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.name AS pasal_name, substr(a.content, 1, 220) AS snippet,
              l.id AS law_id, l.zh_title, l.name AS law_name, l.status AS law_status
       FROM nodes a
       JOIN nodes l ON l.id = json_extract(a.metadata, '$.law_id')
       WHERE a.id IN (${placeholders})`
    )
      .bind(...ids)
      .all<{
        id: string;
        pasal_name: string;
        snippet: string | null;
        law_id: string;
        zh_title: string | null;
        law_name: string;
        law_status: string | null;
      }>();

    const byId = new Map((results ?? []).map((r) => [r.id, r]));
    const out: SemanticHit[] = [];
    for (const h of hits) {
      const row = byId.get(h.id);
      if (!row) continue;
      out.push({
        nodeId: h.id,
        score: h.score,
        lawId: row.law_id,
        lawZhTitle: row.zh_title,
        lawName: row.law_name,
        lawStatus: row.law_status,
        pasalName: row.pasal_name,
        snippet: row.snippet ?? "",
      });
    }
    return out;
  } catch (e) {
    console.error("[semantic] 异常:", e instanceof Error ? e.message : String(e));
    return [];
  }
}
