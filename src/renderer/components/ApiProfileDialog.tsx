import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CodexApiProfileInput } from "../../shared/types";

interface ApiProfileDialogProps {
  onCancel: () => void;
  onSave: (input: CodexApiProfileInput) => void;
}

export function ApiProfileDialog({ onCancel, onSave }: ApiProfileDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState("Custom API");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const canSave = name.trim().length > 0 && apiKey.trim().length > 0 && baseUrl.trim().length > 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md gap-3">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm">{t("apiProfile.title")}</DialogTitle>
          <DialogDescription className="text-[11px] leading-5">
            {t("apiProfile.desc")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) {
              onSave({ name: name.trim(), apiKey: apiKey.trim(), baseUrl: baseUrl.trim() });
            }
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-name" className="mono-label text-[10px] text-muted-foreground">
                {t("common.name")}
              </Label>
              <Input
                id="api-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("apiProfile.namePlaceholder")}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-url" className="mono-label text-[10px] text-muted-foreground">
                {t("apiProfile.baseUrl")}
              </Label>
              <Input
                id="api-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t("apiProfile.urlPlaceholder")}
                className="h-8 font-mono text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key" className="mono-label text-[10px] text-muted-foreground">
                {t("apiProfile.apiKey")}
              </Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("apiProfile.keyPlaceholder")}
                className="h-8 font-mono text-sm"
              />
            </div>

            <p className="text-[11px] text-muted-foreground">{t("apiProfile.noShellReload")}</p>
          </div>

          <DialogFooter className="mt-4 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {t("apiProfile.saveProfile")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
