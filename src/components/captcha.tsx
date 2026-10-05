"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type Turnstile = {
  render: (node: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export function Captcha({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!ready || !ref.current || !key || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(ref.current, {
      sitekey: key,
      callback: (token: string) => {
        setFailed(false);
        onToken(token);
      },
      "expired-callback": () => onToken(""),
      "error-callback": () => {
        setFailed(true);
        onToken("");
      },
      "timeout-callback": () => {
        setFailed(true);
        onToken("");
      },
    });
    return () => api.remove(id);
  }, [ready, key, onToken]);
  if (!key) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => {
          setFailed(true);
          onToken("");
        }}
      />
      <div ref={ref} role="group" aria-label="Security verification" />
      {failed && (
        <p role="alert">
          Security verification could not finish. Reload this page and try
          again.
        </p>
      )}
    </>
  );
}
