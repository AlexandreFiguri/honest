"use client";

import Script from "next/script";

export function RelayerScriptLoader() {
  const src = process.env.NEXT_PUBLIC_RELAYER_SDK_URL ?? "https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs";
  return (
    <Script
      src={src}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
