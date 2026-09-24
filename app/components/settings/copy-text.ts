/**
 * Zkopíruje text do schránky. `navigator.clipboard` funguje jen na HTTPS nebo
 * localhostu — appka ve firmě ale často běží na http://adresa-serveru, proto
 * je tu i starší cesta přes skryté textové pole.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // spadne se do záložní cesty
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
