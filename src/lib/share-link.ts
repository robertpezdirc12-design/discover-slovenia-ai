"use client";

import { toast } from "@/hooks/use-toast";

export type ShareLinkInput = {
  url: string;
  title: string;
  text: string;
  copiedMessage: string;
  errorMessage: string;
};

/** Share a link natively where possible; otherwise copy it with honest feedback. */
export async function shareOrCopyLink({
  url,
  title,
  text,
  copiedMessage,
  errorMessage,
}: ShareLinkInput): Promise<void> {
  if (typeof navigator === "undefined") {
    toast({ title: errorMessage, variant: "destructive" });
    return;
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      // If the native share sheet cannot be opened, attempt clipboard fallback.
    }
  }

  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
    await navigator.clipboard.writeText(url);
    toast({ title: copiedMessage });
  } catch {
    toast({ title: errorMessage, variant: "destructive" });
  }
}
