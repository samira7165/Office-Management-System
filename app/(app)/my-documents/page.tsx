"use client";

import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";

type Doc = { id: number; name: string; category: string; uploadDate: string; size: string; url: string | null };

const CAT_COLORS: Record<string, string> = {
  contract: "var(--primary)", id: "var(--info)", certificate: "var(--success)", general: "var(--muted)",
};

export default function MyDocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then(setDocs);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {docs.map((d) => (
        <div key={d.id} className="card p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${CAT_COLORS[d.category]}1a`, color: CAT_COLORS[d.category] }}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{d.name}</p>
            <p className="text-xs text-muted mt-0.5">{d.size}</p>
            <p className="text-xs text-muted">{d.uploadDate}</p>
          </div>
          {d.url ? (
            <a href={`/api/documents/${d.id}/download`} className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:text-primary hover:bg-primary-light transition shrink-0">
              <Download className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted/40 cursor-not-allowed shrink-0" title="No file attached">
              <Download className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      ))}
      {docs.length === 0 && <p className="text-sm text-muted col-span-full text-center py-10">No documents yet.</p>}
    </div>
  );
}
