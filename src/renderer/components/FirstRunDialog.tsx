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
      .catch((error) => onError(error instanceof Error ? error.message : String(error)));
  }, [onError, t]);

  async function dismiss(): Promise<void> {
    try {
      await window.authSwitch.dismissFirstRun();
      onDone();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
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
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open>
      {/* Prevent accidental close during first-run flow */}
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <p className="mono-label text-[11px] text-muted-foreground">{t("firstRun.label")}</p>
          <DialogTitle className="mt-1">{t("firstRun.title")}</DialogTitle>
        </DialogHeader>

        {!status ? (
          <p className="font-mono text-sm text-muted-foreground">{t("firstRun.checking")}</p>
        ) : status.exists ? (
          <>
            <DialogDescription className="text-sm leading-6">
              {t("firstRun.detectedPrefix")}{" "}
              <code className="font-mono text-foreground">~/.codex/auth.json</code>
              {status.email && (
                <>
                  {" "}
                  {t("firstRun.detectedFor")}{" "}
                  <span className="font-mono font-medium text-foreground">{status.email}</span>
                </>
              )}
              {t("firstRun.detectedSuffix")}
            </DialogDescription>

            <div className="flex flex-col gap-1.5">
              <Label className="mono-label text-[11px] text-muted-foreground">
                {t("common.name")}
              </Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" disabled={busy} onClick={() => void dismiss()}>
                {t("common.skip")}
              </Button>
              <Button disabled={busy || !name.trim()} onClick={() => void handleImport()}>
                {t("common.import")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogDescription className="text-sm leading-6">
              {t("firstRun.noFile")}
            </DialogDescription>
            <DialogFooter>
              <Button autoFocus onClick={() => void dismiss()}>
                {t("common.ok")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
