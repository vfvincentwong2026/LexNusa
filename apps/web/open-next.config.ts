import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig({}),
  // 默认 buildCommand 是 `pnpm build`，会与 opennextjs-cloudflare build 自身递归冲突
  buildCommand: "pnpm exec next build",
};
