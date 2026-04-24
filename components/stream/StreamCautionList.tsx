import type { StreamCautionNote } from '@/lib/streaming';

export function StreamCautionList({ notes }: { notes: StreamCautionNote[] }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-1.5 text-[13px]">
      {notes.map((n) => (
        <li key={n.id} className="flex gap-2">
          <span
            className={`shrink-0 inline-block w-10 text-center text-[11px] leading-[18px] ${
              n.severity === 'warn'
                ? 'border border-amber-500 text-amber-700'
                : 'border border-border text-muted-foreground'
            }`}
          >
            {n.severity === 'warn' ? '注意' : 'メモ'}
          </span>
          <div className="min-w-0">
            <div className="font-medium">{n.label}</div>
            <div className="text-muted-foreground">{n.body}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
