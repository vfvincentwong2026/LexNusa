export default function SearchBox({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  // 纯 HTML 表单（GET /search?q=...），无需客户端 JS
  return (
    <form action="/search" method="get" className="flex w-full">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="搜索印尼法规，如：裁员补偿 / pesangon / PMA 注册资本"
        className="h-11 w-full rounded-none border border-zinc-300 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-accent"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-none border border-accent bg-accent px-5 text-sm font-medium text-white hover:bg-blue-800"
      >
        搜索
      </button>
    </form>
  );
}
