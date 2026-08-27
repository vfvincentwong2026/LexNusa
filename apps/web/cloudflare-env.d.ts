// Cloudflare 绑定的环境类型（可由 `pnpm cf-typegen` 重新生成）
interface CloudflareEnv {
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;
  NEXT_PUBLIC_BASE_URL: string;
}
