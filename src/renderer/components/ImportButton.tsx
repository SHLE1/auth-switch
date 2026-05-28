import { useState } from "react";
import { FileJson, Plus, ClipboardPaste } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "../../shared/errors";
import { authSwitch } from "../api/authSwitch";
import type { ImportResult } from "../../shared/types";

interface ImportButtonProps {
  onImported: (result: ImportResult) => void;
  onError: (message: string) => void;
  onPasteJson: () => void;
}

export function ImportButton({ onImported, onError, onPasteJson }: ImportButtonProps): JSX.Element {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={busy}
          className="h-7 gap-1 px-2.5 font-mono text-xs"
        >
          <Plus size={12} />
          {busy ? t("importButton.importing") : t("importButton.addAuth")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => void handleImport()} disabled={busy} className="font-mono text-xs">
          <FileJson size={12} />
          {t("importButton.fromFile")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPasteJson} disabled={busy} className="font-mono text-xs">
          <ClipboardPaste size={12} />
          {t("importButton.pasteJson")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
