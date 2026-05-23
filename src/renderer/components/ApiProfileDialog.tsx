import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  { name: "Azure OpenAI", baseUrl: "https://YOUR_RESOURCE_NAME.openai.azure.com/openai" }
];

export function ApiProfileDialog({ onCancel, onSave }: ApiProfileDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState("Custom API");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const canSave = name.trim().length > 0 && apiKey.trim().length > 0 && baseUrl.trim().length > 0;

  function applyPreset(index: number): void {
    const preset = presets[index];
    if (!preset) return;
    setName(preset.name === "Custom" ? "Custom API" : preset.name);
    setBaseUrl(preset.baseUrl);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
      <form
        className="w-full max-w-lg rounded-2xl border border-console-line bg-console-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) {
            onSave({ name: name.trim(), apiKey: apiKey.trim(), baseUrl: baseUrl.trim() });
          }
        }}
      >
        <h2 className="text-lg font-semibold text-console-text">{t("apiProfile.title")}</h2>
        <p className="mt-2 text-sm leading-5 text-console-muted">
          {t("apiProfile.desc").split("openai_base_url").map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <span className="font-mono">openai_base_url</span>
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">{t("apiProfile.preset")}</span>
          <select
            onChange={(event) => applyPreset(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            defaultValue="0"
          >
            {presets.map((preset, index) => (
              <option key={preset.name} value={index}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">{t("common.name")}</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            placeholder={t("apiProfile.namePlaceholder")}
          />
        </label>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">{t("apiProfile.baseUrl")}</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            placeholder={t("apiProfile.urlPlaceholder")}
          />
        </label>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">{t("apiProfile.apiKey")}</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            placeholder={t("apiProfile.keyPlaceholder")}
          />
        </label>

        <p className="mt-3 text-xs leading-5 text-console-muted">{t("apiProfile.noShellReload")}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-console-line px-3 py-2 font-mono text-sm text-console-muted hover:text-console-text"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
          >
            {t("apiProfile.saveProfile")}
          </button>
        </div>
      </form>
    </div>
  );
}
