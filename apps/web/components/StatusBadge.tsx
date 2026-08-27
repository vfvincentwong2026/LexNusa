const STATUS_MAP: Record<string, { zh: string; id: string; cls: string }> = {
  berlaku: { zh: "现行", id: "Berlaku", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  diubah: { zh: "已修订", id: "Diubah", cls: "border-amber-300 bg-amber-50 text-amber-700" },
  dicabut: { zh: "已废止", id: "Dicabut", cls: "border-red-300 bg-red-50 text-red-700" },
};

export default function StatusBadge({ status }: { status: string | null }) {
  const s = status ? STATUS_MAP[status.toLowerCase()] : undefined;
  if (!s) {
    return (
      <span className="inline-block rounded-none border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-500">
        状态未知
      </span>
    );
  }
  return (
    <span className={`inline-block rounded-none border px-1.5 py-0.5 text-xs ${s.cls}`}>
      {s.zh} · {s.id}
    </span>
  );
}
