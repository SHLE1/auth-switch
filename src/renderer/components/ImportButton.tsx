import { useState } from "react";
import { Plus } from "lucide-react";
import type { ImportResult } from "../types";

interface ImportButtonProps {
  onImported: (result: ImportResult) => void;
  onError: (message: string) => void;
}

export function ImportButton({ onImported, onError }: ImportButtonProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  async function handleImport(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const result = await window.authSwitch.importAuthFile();
      if (result.cancelled) return;
      if (!result.success) {
        onError(result.error ?? "Import failed.");
        return;
      }
      onImported(result);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleImport()}
      className="inline-flex items-center gap-2 rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green transition hover:bg-console-green/20"
    >
      <Plus size={16} />
      {busy ? "Importing..." : "Add auth.json"}
    </button>
  );
}
