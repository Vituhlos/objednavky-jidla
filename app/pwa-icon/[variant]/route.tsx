import { ImageResponse } from "next/og";
import { CUTLERY_PATH, PWA_GRADIENT, PWA_ICONS } from "@/lib/pwa-assets";

export const dynamicParams = false;

export function generateStaticParams() {
  return PWA_ICONS.map(({ variant }) => ({ variant }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const icon = PWA_ICONS.find((i) => i.variant === variant);
  if (!icon) return new Response("Not found", { status: 404 });

  const { size, maskable } = icon;
  // Bezpečná zóna maskable ikony je kruh o průměru 80 %; příbor se drží uvnitř.
  const glyph = Math.round(size * (maskable ? 0.46 : 0.55));
  return new ImageResponse(
    <div style={{
      width: size, height: size, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: PWA_GRADIENT,
      borderRadius: maskable ? 0 : Math.round(size * 0.22),
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={glyph} height={glyph} fill="white">
        <path d={CUTLERY_PATH} />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
