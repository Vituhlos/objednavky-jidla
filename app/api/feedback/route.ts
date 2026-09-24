import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-auth";
import { addFeedback, detectDevice, formatFeedbackTelegram, validateFeedbackInput } from "@/lib/feedback";
import { AttachmentError, processImage, type ProcessedImage } from "@/lib/feedback-attachments";
import { FEEDBACK_ATTACHMENT_LIMITS } from "@/lib/feedback-meta";
import { sendTelegramFeedbackNotification } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const PER_IP = 5;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
// Strop pro celou appku: i s IP od Cloudflaru si útočník může adresy střídat, tak ať spam
// nezaplní databázi, disk ani Telegram adminů, ani když se IP střídají.
const GLOBAL = 100;
const GLOBAL_WINDOW_MS = 24 * 60 * 60 * 1000;

// Celé tělo požadavku: tři obrázky na maximu plus text a rezerva na multipart
const MAX_BODY_BYTES = FEEDBACK_ATTACHMENT_LIMITS.maxFiles * FEEDBACK_ATTACHMENT_LIMITS.maxInputBytes + 256 * 1024;

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

/**
 * Odeslání připomínky z /pripominky, volitelně se screenshoty.
 *
 * Route handler, ne Server Action: ty mají strop těla 1 MB a obrázky by se
 * do něj nevešly. Veřejný vstup — všechno se ověřuje tady, klient je jen pohodlí.
 */
export async function POST(req: NextRequest): Promise<Response> {
  // Bez Content-Length by se velikost dala obejít chunkovaným tělem — prohlížeč ji u FormData posílá vždy
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return fail("Chybí velikost požadavku.", 411);
  if (declared > MAX_BODY_BYTES) return fail("Obrázky jsou dohromady příliš velké.", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Požadavek se nepodařilo přečíst.");
  }

  // Past na roboty: pole `website` je pro člověka neviditelné. Kdo ho vyplní,
  // dostane stejnou odpověď jako úspěch, ať nepozná, že byl odhalen.
  if (form.get("website")) return Response.json({ ok: true });

  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = validateFeedbackInput({
    category: text("category"),
    message: text("message"),
    authorName: text("authorName"),
    page: text("page"),
    context: text("context"),
    appVersion: text("appVersion"),
  });
  if (!parsed.ok) return fail(parsed.error);

  const files = form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > FEEDBACK_ATTACHMENT_LIMITS.maxFiles) {
    return fail(`Obrázky můžou být nejvýš ${FEEDBACK_ATTACHMENT_LIMITS.maxFiles}.`);
  }
  if (files.some((f) => f.size > FEEDBACK_ATTACHMENT_LIMITS.maxInputBytes)) {
    return fail("Některý z obrázků je příliš velký.", 413);
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(`feedback:${ip}`, PER_IP, PER_IP_WINDOW_MS)) {
    return fail("Teď toho posíláš hodně najednou. Zkus to zase za hodinu.", 429);
  }
  if (!checkRateLimit("feedback:global", GLOBAL, GLOBAL_WINDOW_MS)) {
    return fail("Dnes už přišlo připomínek příliš mnoho. Zkus to zítra.", 429);
  }

  let images: ProcessedImage[];
  try {
    images = [];
    // Postupně, ne paralelně — dekódování je náročné na paměť
    for (const f of files) images.push(await processImage(Buffer.from(await f.arrayBuffer())));
  } catch (err) {
    return fail(err instanceof AttachmentError ? err.message : "Obrázek se nepodařilo zpracovat.");
  }

  let created;
  try {
    created = addFeedback(parsed.data, detectDevice(req.headers.get("user-agent")), images);
  } catch (err) {
    if (err instanceof AttachmentError) return fail(err.message, 507);
    console.error("[feedback] Uložení selhalo:", err);
    return fail("Připomínku se nepodařilo uložit. Zkus to znovu.", 500);
  }

  // Upozornění nesmí zdržet ani shodit odeslání formuláře
  void sendTelegramFeedbackNotification(formatFeedbackTelegram(created.entry)).catch((err) =>
    console.error("[feedback] Telegram upozornění selhalo:", err),
  );

  revalidatePath("/pripominky");
  // Tajný kód dostane jen autor — prohlížeč si ho uloží a přes /api/feedback/mine
  // pak uvidí stav a odpověď. V DB je jen jeho hash.
  return Response.json({ ok: true, id: created.entry.id, token: created.token });
}
