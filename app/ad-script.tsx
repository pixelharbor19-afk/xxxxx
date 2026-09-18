import Script from "next/script";

export default function AdScript() {
  return (
    <Script
      id="anti-adblock-script"
      src="/ad-script.js"
      strategy="afterInteractive"
    />
  );
}
