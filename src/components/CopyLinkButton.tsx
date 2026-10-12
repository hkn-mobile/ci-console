"use client";

import { useState } from "react";
import { ghostButton } from "@/components/ui";

/** Copies a URL to the clipboard. Falls back to execCommand because the console is served over plain http, where navigator.clipboard is missing. */
export function CopyLinkButton({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("textarea");
      input.value = url;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" onClick={copy} className={`${ghostButton} py-1.5`} title={url}>
      {copied ? "Đã copy ✓" : label}
    </button>
  );
}
