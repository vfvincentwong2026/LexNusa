import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDb(): D1Database {
  return (getCloudflareContext().env as unknown as CloudflareEnv).DB;
}

export interface LawNode {
  id: string;
  name: string;
  type: string;
  status: string | null;
  number: string | null;
  year: number | null;
  zh_title: string | null;
  zh_summary: string | null;
  domain?: string | null;
}

/** LIKE 通配符转义（% 和 _） */
export function likePattern(q: string): string {
  return "%" + q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
}
