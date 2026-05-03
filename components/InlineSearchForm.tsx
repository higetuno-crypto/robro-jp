/**
 * /tags や /creators のページ内で使う、軽量な検索フォーム（GET 送信）。
 * 同じページに ?q= で submit して、page 側で filter する。
 *
 * SearchBox（ヘッダー）はクライアント遷移するが、こちらは Server Component 同士の
 * URL ベースのやり取りなのでフォーム submit でOK。
 */
export function InlineSearchForm({
  action,
  placeholder,
  defaultValue,
  paramName = 'q',
}: {
  action: string;
  placeholder: string;
  defaultValue?: string;
  paramName?: string;
}) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="flex items-center gap-2"
    >
      <input
        type="search"
        name={paramName}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={60}
        className="text-[13px] px-2 py-1 border border-border bg-background w-full sm:w-[240px] outline-none focus:border-foreground"
      />
      <button
        type="submit"
        className="text-[13px] px-3 py-1 border border-border hover:bg-muted shrink-0"
      >
        検索
      </button>
      {defaultValue ? (
        <a
          href={action}
          className="text-[12px] text-muted-foreground hover:underline shrink-0"
        >
          クリア
        </a>
      ) : null}
    </form>
  );
}
