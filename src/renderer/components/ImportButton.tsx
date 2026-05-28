import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "../../shared/errors";
import { authSwitch } from "../api/authSwitch";
import type { ImportResult } from "../../shared/types";

interface ImportButtonProps {
  onImported: (result: ImportResult) => void;
  onError: (message: string) => void;
}

export function ImportButton({ onImported, onError }: ImportButtonProps): JSX.Element {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleImport(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const result = await authSwitch.importAuthFile();
      if (result.cancelled) return;
      if (!result.success) {
        onError(result.error ?? t("error.importFailed"));
        return;
      }
      onImported(result);
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={() => void handleImport()}
      className="h-7 gap-1 px-2.5 font-mono text-xs"
    >
      <Plus size={12} />
      {busy ? t("importButton.importing") : t("importButton.addAuth")}
    </Button>
  );
}
