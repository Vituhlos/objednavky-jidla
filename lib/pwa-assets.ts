/**
 * Ikony a úvodní obrazovky nainstalované appky. Jeden seznam pro routy, které
 * obrázky kreslí, i pro manifest a metadata, které na ně odkazují.
 */

export const PWA_BG = "#f8f4ef";
export const PWA_GRADIENT = "linear-gradient(135deg, #F59E0B, #EA580C)";
export const CUTLERY_PATH =
  "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z";

/**
 * „maskable" ikonu si Android ořízne do vlastního tvaru (kruh, squircle), takže
 * je bez zaoblení a s motivem uvnitř bezpečné zóny. „any" se neořezává.
 */
export const PWA_ICONS = [
  { variant: "192", size: 192, maskable: false },
  { variant: "512", size: 512, maskable: false },
  { variant: "maskable-192", size: 192, maskable: true },
  { variant: "maskable-512", size: 512, maskable: true },
] as const;

/**
 * iOS bere úvodní obrazovku jen v přesném rozlišení zařízení; bez shody ukáže
 * při startu bílou plochu. Rozměry v CSS px na výšku + poměr pixelů.
 */
export const IOS_SPLASH_SCREENS = [
  { w: 320, h: 568, dpr: 2 }, // SE (1. gen)
  { w: 375, h: 667, dpr: 2 }, // SE (2./3. gen), 8
  { w: 414, h: 736, dpr: 3 }, // 8 Plus
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14, 16e
  { w: 428, h: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 402, h: 874, dpr: 3 }, // 16 Pro, 17, 17 Pro
  { w: 420, h: 912, dpr: 3 }, // Air
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max, 17 Pro Max
] as const;

export function splashSizeParam(s: { w: number; h: number; dpr: number }): string {
  return `${s.w * s.dpr}x${s.h * s.dpr}`;
}
