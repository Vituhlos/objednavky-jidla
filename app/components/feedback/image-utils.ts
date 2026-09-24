import { FEEDBACK_ATTACHMENT_LIMITS, FEEDBACK_ATTACHMENT_TYPES } from "@/lib/feedback-meta";

export function isAcceptedImage(file: { type: string }): boolean {
  return (FEEDBACK_ATTACHMENT_TYPES as readonly string[]).includes(file.type);
}

/** Rozměry po zmenšení delší strany na `max` — nikdy nezvětšuje. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Zmenší obrázek v prohlížeči, ať se neposílají megabajty z 4K monitoru nebo
 * telefonu. Server stejně vše znovu zakóduje; tohle jen šetří data a čas.
 * Když to prohlížeč neumí, pošle se originál.
 */
export async function downscaleImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, FEEDBACK_ATTACHMENT_LIMITS.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    // Safari starší než 17 neumí WebP do canvasu a vrátí PNG — i to je v pořádku
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
