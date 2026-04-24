import Link from 'next/link';

export function StreamSlotCard({
  slotKey,
  title,
  description,
  count,
}: {
  slotKey: string;
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <Link
      href={`/stream/${slotKey}`}
      className="block border border-border bg-card hover:bg-muted/40 px-3 py-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-medium leading-tight truncate">{title}</div>
        {typeof count === 'number' && (
          <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">{count}</div>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground truncate">{description}</div>
    </Link>
  );
}
