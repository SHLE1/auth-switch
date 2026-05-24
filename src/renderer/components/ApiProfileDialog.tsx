import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CodexApiProfileInput } from "../types";

interface ApiProfileDialogProps {
  onCancel: () => void;
  onSave: (input: CodexApiProfileInput) => void;
}

const presets = [
  { name: "Custom", baseUrl: "" },
  { name: "AiHubMix", baseUrl: "https://aihubmix.com/v1" },
  { name: "PatewayAI", baseUrl: "https://api.pateway.ai/v1" },
  { name: "DMXAPI", baseUrl: "https://www.dmxapi.cn/v1" },
  { name: "Azure OpenAI", baseUrl: "https://YOUR_RESOURCE_NAME.openai.azure.com/openai" },
];

export function ApiProfileDialog({ onCancel, onSave }: ApiProfileDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState("Custom API");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const canSave =
    name.trim().length > 0 && apiKey.trim().length > 0 && baseUrl.trim().length > 0;

  function applyPreset(value: string): void {
    const preset = presets.find((p) => p.name === value);
    if (!preset) return;
    setName(preset.name === "Custom" ? "Custom API" : preset.name);
    setBaseUrl(preset.baseUrl);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("apiProfile.title")}</DialogTitle>
          <DialogDescription className="text-xs leading-5">
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
          <div className="flex flex-col gap-4 py-2">
            {/* Preset picker */}
            <div className="flex flex-col gap-1.5">
              <Label className="mono-label text-[11px] text-muted-foreground">
                {t("apiProfile.preset")}
              </Label>
              <Select onValueChange={applyPreset} defaultValue="Custom">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-name" className="mono-label text-[11px] text-muted-foreground">
                {t("common.name")}
              </Label>
              <Input
                id="api-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("apiProfile.namePlaceholder")}
              />
            </div>

            {/* Base URL */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-url" className="mono-label text-[11px] text-muted-foreground">
                {t("apiProfile.baseUrl")}
              </Label>
              <Input
                id="api-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={t("apiProfile.urlPlaceholder")}
              />
            </div>

            {/* API Key */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key" className="mono-label text-[11px] text-muted-foreground">
                {t("apiProfile.apiKey")}
              </Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("apiProfile.keyPlaceholder")}
              />
            </div>

            <p className="text-xs text-muted-foreground">{t("apiProfile.noShellReload")}</p>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canSave}>
              {t("apiProfile.saveProfile")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
