/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// 使 `next dev` 下也能通过 getRequestContext() 访问 wrangler.toml 中的绑定（D1 等）
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
