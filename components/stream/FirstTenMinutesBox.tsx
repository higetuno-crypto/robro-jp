export function FirstTenMinutesBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="border-l-2 border-foreground pl-3 text-[13px]">
      <div className="text-[12px] text-muted-foreground mb-0.5">最初の10分</div>
      <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

export function WhyNowPopularBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="border-l-2 border-foreground pl-3 text-[13px]">
      <div className="text-[12px] text-muted-foreground mb-0.5">今これが配信向きな理由</div>
      <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}
