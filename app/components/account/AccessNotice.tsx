import Link from "next/link";
import MIcon from "../MIcon";
import { AccountShell } from "./AccountShell";

/**
 * Klidné sdělení, že sem uživatel nemá přístup.
 *
 * Navazuje na tón, jakým appka hlásí zavřený provoz — ne strohá chyba, ale
 * věta a cesta dál. Tichý přesměrovací skok by byl horší: člověk by nevěděl,
 * jestli se něco rozbilo, nebo jestli tam prostě nemá co dělat.
 */
export function AccessNotice({
  emoji,
  title,
  text,
  action,
}: {
  emoji: string;
  title: string;
  text: string;
  action: { href: string; label: string };
}) {
  return (
    <AccountShell icon="lock" title={title}>
      <div className="glass rounded-3xl max-w-sm mx-auto mt-8">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <span aria-hidden="true" className="text-[40px] leading-none">
            {emoji}
          </span>
          <div>
            <p className="font-display font-bold text-[17px] text-stone-900">{title}</p>
            <p className="text-[12.5px] text-stone-500 mt-1">{text}</p>
          </div>
          <Link
            className="modal-btn modal-btn--primary w-full flex items-center justify-center gap-2"
            href={action.href}
          >
            <MIcon name="arrow_forward" size={16} />
            {action.label}
          </Link>
        </div>
      </div>
    </AccountShell>
  );
}
