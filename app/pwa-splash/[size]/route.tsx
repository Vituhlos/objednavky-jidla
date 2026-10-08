import { ImageResponse } from "next/og";
import { CUTLERY_PATH, IOS_SPLASH_SCREENS, PWA_BG, PWA_GRADIENT, splashSizeParam } from "@/lib/pwa-assets";

export const dynamicParams = false;

export function generateStaticParams() {
  return IOS_SPLASH_SCREENS.map((s) => ({ size: splashSizeParam(s) }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const screen = IOS_SPLASH_SCREENS.find((s) => splashSizeParam(s) === size);
  if (!screen) return new Response("Not found", { status: 404 });

  const width = screen.w * screen.dpr;
  const height = screen.h * screen.dpr;
  const tile = Math.round(width * 0.26);
  return new ImageResponse(
    <div style={{
      width, height, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: PWA_BG,
    }}>
      <div style={{
        width: tile, height: tile, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: PWA_GRADIENT,
        borderRadius: Math.round(tile * 0.22),
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={Math.round(tile * 0.55)} height={Math.round(tile * 0.55)} fill="white">
          <path d={CUTLERY_PATH} />
        </svg>
      </div>
    </div>,
    { width, height },
  );
}
