import { useEffect, useState } from "react";
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
import { authSwitch } from "../api/authSwitch";
import type { Account, CodexApiProfileInput } from "../../shared/types";

interface ApiProfileDialogProps {
  /** When provided the dialog opens in edit mode pre-filled with the stored values. */
  editAccount?: Account;
  onCancel: () => void;
  onSave: (input: CodexApiProfileInput) => void;
}


export function ApiProfileDialog({ editAccount, onCancel, onSave }: ApiProfileDialogProps): JSX.Element {
  const { t } = useTranslation();
  const isEdit = editAccount !== undefined;

  const [name, setName] = useState(isEdit ? "" : "Custom API");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!editAccount) return;
    setLoading(true);
    authSwitch
      .getProfileEditData(editAccount.id)
      .then((data) => {
        setName(data.name);
        setApiKey(data.apiKey);
        setBaseUrl(data.baseUrl);
      })
      .finally(() => setLoading(false));
  }, [editAccount]);

  const canSave = !loading && name.trim().length > 0 && apiKey.trim().length > 0 && baseUrl.trim().length > 0;


  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md gap-3">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm">
            {isEdit ? t("apiProfile.editTitle") : t("apiProfile.title")}
          </DialogTitle>
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
                autoFocus={!isEdit}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("apiProfile.namePlaceholder")}
                className="h-8 text-sm"
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-url" className="mono-label text-[10px] text-muted-foreground">
                {t("apiProfile.baseUrl")}
              </Label>
              <Input
                id="api-url"
                autoFocus={isEdit}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t("apiProfile.urlPlaceholder")}
                className="h-8 font-mono text-sm"
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            <p className="text-[11px] text-muted-foreground">{t("apiProfile.noShellReload")}</p>
          </div>

          <DialogFooter className="mt-4 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {isEdit ? t("common.save") : t("apiProfile.saveProfile")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
