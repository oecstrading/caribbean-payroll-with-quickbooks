import { toast } from "sonner";

/** Save a file without opening a new tab (new tabs on preview addresses can be blocked by Edge). */
export async function downloadFile(url: string, filename?: string) {
  const name = filename || decodeURIComponent(url.split("?")[0].split("/").pop() || "document.pdf");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
  } catch {
    toast.error("Couldn't download the file. Please try again.");
  }
}
