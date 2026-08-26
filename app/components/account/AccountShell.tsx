import MIcon from "../MIcon";

/**
 * Rám obrazovek kolem účtu.
 *
 * Kopíruje hlavičku, jakou má Nastavení i Historie, aby nové stránky
 * nepůsobily jako přilepený modul. Nadpis je tady `h1` — karty uvnitř mají
 * vlastní vizuální titulek, ale ten už nadpis není, stejně jako u PIN brány.
 */
export function AccountShell({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: string;
  title: string;
}) {
  return (
    <div className="k-shell">
      <div className="hidden md:flex px-5 py-2.5 border-b border-white/50 items-center gap-3 topbar shrink-0">
        <MIcon name={icon} size={16} fill style={{ color: "#D97706" }} />
        <h1 className="font-display font-bold text-[15px] text-stone-900">{title}</h1>
      </div>

      <div className="md:hidden border-b border-white/50 topbar shrink-0 px-4 py-2.5">
        <h1 className="font-display font-bold text-[14px] text-stone-900">{title}</h1>
      </div>

      <main className="flex-1 overflow-y-auto scroll-area p-4 md:p-5 space-y-4 pb-nav md:pb-24">
        {children}
      </main>
    </div>
  );
}
