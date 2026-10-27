import { useEffect, useState } from "react";
import { privateFileUrl } from "@/lib/private-storage";

export default function PrivateMedia({ bucket, stored, audio = false, className = "", alt = "Evidence" }: { bucket: string; stored: string; audio?: boolean; className?: string; alt?: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setUrl(""); setFailed(false);
    const refresh = () => { void privateFileUrl(bucket, stored).then(url => { if (!cancelled) setUrl(url); }).catch(() => { if (!cancelled) setFailed(true); }); };
    refresh(); const interval = window.setInterval(refresh, 240000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [bucket, stored]);
  if (!url) return <span className="text-xs text-muted-foreground">{failed ? "File unavailable" : "Loading file…"}</span>;
  return audio ? <audio controls src={url} className={className} /> : <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={alt} className={className} /></a>;
}