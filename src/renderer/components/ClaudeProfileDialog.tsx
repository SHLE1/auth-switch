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
import type { Account, ClaudeProfileInput } from "../../shared/types";

interface ClaudeProfileDialogProps {
  /** When provided the dialog opens in edit mode pre-filled with the stored values. */
  editAccount?: Account;
  onCancel: () => void;
  onSave: (input: ClaudeProfileInput) => void;
}

export function ClaudeProfileDialog({ editAccount, onCancel, onSave }: ClaudeProfileDialogProps): JSX.Element {
  const { t } = useTranslation();
  const isEdit = editAccount !== undefined;

  const [name, setName] = useState(isEdit ? "" : "Claude API");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [haikuModel, setHaikuModel] = useState("");
  const [sonnetModel, setSonnetModel] = useState("");
  const [opusModel, setOpusModel] = useState("");
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
        setHaikuModel(data.haikuModel);
        setSonnetModel(data.sonnetModel);
        setOpusModel(data.opusModel);
      })
      .finally(() => setLoading(false));
  }, [editAccount]);

  const canSave = !loading && name.trim().length > 0 && apiKey.trim().length > 0;

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
            {isEdit ? t("claudeProfile.editTitle") : t("claudeProfile.title")}
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-5">
            {t("claudeProfile.desc")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) {
              onSave({
                name: name.trim(),
                apiKey: apiKey.trim(),
                apiKeyField: "ANTHROPIC_AUTH_TOKEN",
                baseUrl: baseUrl.trim() || undefined,
                haikuModel: haikuModel.trim() || undefined,
                sonnetModel: sonnetModel.trim() || undefined,
                opusModel: opusModel.trim() || undefined
              });
            }
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claude-name" className="mono-label text-[10px] text-muted-foreground">
                {t("common.name")}
              </Label>
              <Input
                id="claude-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("claudeProfile.namePlaceholder")}
                className="h-8 text-sm"
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claude-key" className="mono-label text-[10px] text-muted-foreground">
                {t("claudeProfile.apiKey")}
              </Label>
              <Input
                id="claude-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("claudeProfile.keyPlaceholder")}
                className="h-8 font-mono text-sm"
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claude-url" className="mono-label text-[10px] text-muted-foreground">
                {t("claudeProfile.baseUrl")}
              </Label>
              <Input
                id="claude-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t("claudeProfile.baseUrlPlaceholder")}
                className="h-8 font-mono text-sm"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="claude-haiku-model" className="mono-label text-[10px] text-muted-foreground">
                  {t("claudeProfile.haikuModel")}
                </Label>
                <Input
                  id="claude-haiku-model"
                  value={haikuModel}
                  onChange={(e) => setHaikuModel(e.target.value)}
                  placeholder="haiku"
                  className="h-8 font-mono text-sm"
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="claude-sonnet-model" className="mono-label text-[10px] text-muted-foreground">
                  {t("claudeProfile.sonnetModel")}
                </Label>
                <Input
                  id="claude-sonnet-model"
                  value={sonnetModel}
                  onChange={(e) => setSonnetModel(e.target.value)}
                  placeholder="sonnet"
                  className="h-8 font-mono text-sm"
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="claude-opus-model" className="mono-label text-[10px] text-muted-foreground">
                  {t("claudeProfile.opusModel")}
                </Label>
                <Input
                  id="claude-opus-model"
                  value={opusModel}
                  onChange={(e) => setOpusModel(e.target.value)}
                  placeholder="opus"
                  className="h-8 font-mono text-sm"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {isEdit ? t("common.save") : t("claudeProfile.saveProfile")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
