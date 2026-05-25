import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  mobileTitle?: string;
  leading?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  searchBar?: ReactNode;
  secondaryRow?: ReactNode;
};

export default function PageHeader({
  title,
  mobileTitle,
  leading,
  meta,
  trailing,
  actions,
  searchBar,
  secondaryRow,
}: PageHeaderProps) {
  const shortTitle = mobileTitle ?? title;

  return (
    <div className="border-b border-white/50 topbar shrink-0">
      <div className="px-4 md:px-5 py-2.5 flex items-center gap-2 md:gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-display font-bold text-stone-900 text-[14px] md:text-[15px] truncate shrink min-w-0">
            <span className="md:hidden">{shortTitle}</span>
            <span className="hidden md:inline">{title}</span>
          </span>
          {meta && (
            <span className="inline-block text-[11px] md:text-[12px] text-stone-500 shrink-0">{meta}</span>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
        {actions && (
          <div className={`${secondaryRow ? "hidden md:flex" : "flex"} items-center gap-2 md:gap-3 shrink-0`}>{actions}</div>
        )}
        {searchBar && (
          <div className="hidden md:block shrink-0">{searchBar}</div>
        )}
      </div>
      {(searchBar || secondaryRow) && (
        <div className="md:hidden">
          {secondaryRow && (
            <div className="flex items-center gap-2 px-4 pb-2.5 flex-wrap">{secondaryRow}</div>
          )}
          {searchBar && (
            <div className="px-4 pb-2.5">{searchBar}</div>
          )}
        </div>
      )}
    </div>
  );
}
