"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteAnalysis } from "@/lib/api";

export default function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteAnalysis(id);
      router.refresh();
    } catch {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      aria-label="Delete this analysis"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-all duration-250 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
