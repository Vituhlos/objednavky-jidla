import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: 512, height: 512, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #32ADE6, #30D158)",
      borderRadius: 114,
    }}>
      {/* příbor – vidlička vlevo, nůž vpravo */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="280" height="280" fill="white">
        <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
      </svg>
    </div>,
    size,
  );
}
