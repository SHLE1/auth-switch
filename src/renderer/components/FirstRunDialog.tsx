import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "../../shared/errors";
import type { LiveAuthStatus } from "../types";

interface FirstRunDialogProps {
  onDone: () => void;
  onError: (message: string) => void;
}

export function FirstRunDialog({ onDone, onError }: FirstRunDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LiveAuthStatus | null>(null);
  const [name, setName] = useState(t("firstRun.unnamedAccount"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.authSwitch
      .getLiveAuthStatus()
      .then((nextStatus) => {
        setStatus(nextStatus);
        setName(nextStatus.email ?? t("firstRun.unnamedAccount"));
      })
      .catch((error) => onError(getErrorMessage(error)));
  }, [onError, t]);

  async function dismiss(): Promise<void> {
    try {
      await window.authSwitch.dismissFirstRun();
      onDone();
    } catch (error) {
      onError(getErrorMessage(error));
    }
  }

  async function handleImport(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.authSwitch.importLiveAuthFile(name, true);
      if (!result.success) {
        onError(result.error ?? t("error.importFailed"));
        return;
      }
      await dismiss();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-sm gap-3"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="gap-1">
          <p className="mono-label text-[10px] text-muted-foreground">{t("firstRun.label")}</p>
          <DialogTitle className="text-sm">{t("firstRun.title")}</DialogTitle>
        </DialogHeader>

        {!status ? (
          <p className="font-mono text-xs text-muted-foreground">{t("firstRun.checking")}</p>
        ) : status.exists ? (
          <>
            <DialogDescription className="text-xs leading-5">
              {t("firstRun.detectedPrefix")}{" "}
              <code className="font-mono">~/.codex/auth.json</code>
              {status.email && (
                <> {t("firstRun.detectedFor")} <span className="font-mono font-medium text-foreground">{status.email}</span></>
              )}
              {t("firstRun.detectedSuffix")}
            </DialogDescription>
            <div className="flex flex-col gap-1.5">
              <Label className="mono-label text-[10px] text-muted-foreground">
                {t("common.name")}
              </Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <DialogFooter className="gap-1.5">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void dismiss()}>
                {t("common.skip")}
              </Button>
              <Button size="sm" disabled={busy || !name.trim()} onClick={() => void handleImport()}>
                {t("common.import")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogDescription className="text-xs leading-5">
              {t("firstRun.noFile")}
            </DialogDescription>
            <DialogFooter>
              <Button size="sm" autoFocus onClick={() => void dismiss()}>
                {t("common.ok")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
