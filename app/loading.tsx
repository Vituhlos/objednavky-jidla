/**
 * Kostra stránky během přechodu mezi stránkami. Bez ní se po klepnutí na jinou
 * položku navigace na pomalém připojení chvíli nedělo nic.
 *
 * Záměrně obecná (záhlaví + pár karet), stejná pro všechny stránky — jde o to
 * dát najevo, že klepnutí zabralo, ne napodobit konkrétní obsah.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Načítání" className="k-shell skeleton-shell" role="status">
      <div className="topbar shrink-0 border-b border-white/50 px-4 md:px-5 min-h-[60px] flex items-center">
        <span className="skeleton h-5 w-44 rounded-lg" />
      </div>
      <div className="flex-1 overflow-hidden p-4 md:p-5 flex flex-col gap-4">
        <span className="skeleton h-12 w-64 max-w-full rounded-2xl" />
        <span className="skeleton h-32 rounded-3xl" />
        <span className="skeleton h-32 rounded-3xl" />
        <span className="skeleton h-24 rounded-3xl" />
      </div>
    </div>
  );
}
