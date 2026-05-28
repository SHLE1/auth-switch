import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getErrorMessage } from "../../shared/errors";
import { authSwitch } from "../api/authSwitch";
import type { ImportResult } from "../../shared/types";

interface PasteAuthJsonDialogProps {
  onCancel: () => void;
  onImported: (result: ImportResult) => void;
  onError: (message: string) => void;
}

export function PasteAuthJsonDialog({ onCancel, onImported, onError }: PasteAuthJsonDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleImport(): Promise<void> {
    if (busy) return;

    const trimmed = content.trim();
    if (!trimmed) {
      onError(t("pasteAuthJson.empty"));
      return;
    }

    setBusy(true);
    try {
      const result = await authSwitch.importAuthJsonContent(trimmed);
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
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("pasteAuthJson.title")}</DialogTitle>
          <DialogDescription>{t("pasteAuthJson.desc")}</DialogDescription>
        </DialogHeader>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t("pasteAuthJson.placeholder")}
          spellCheck={false}
          className="min-h-[260px] w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={busy}>
            {busy ? t("importButton.importing") : t("common.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
