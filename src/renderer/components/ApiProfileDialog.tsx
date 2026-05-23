import { useState } from "react";
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
        <h2 className="text-lg font-semibold text-console-text">Add Codex API profile</h2>
        <p className="mt-2 text-sm leading-5 text-console-muted">
          Creates a Codex profile that writes API-key auth.json and only manages the{" "}
          <span className="font-mono">openai_base_url</span> line in config.toml. Switching back to auth.json comments that line out.
        </p>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">Preset</span>
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
          <span className="mono-label text-[11px] text-console-muted">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            placeholder="AiHubMix"
          />
        </label>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">Base URL</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            placeholder="https://api.example.com/v1"
          />
        </label>

        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
            placeholder="sk-..."
          />
        </label>

        <p className="mt-3 text-xs leading-5 text-console-muted">No shell reload is required for the Codex app.</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-console-line px-3 py-2 font-mono text-sm text-console-muted hover:text-console-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
          >
            Save profile
          </button>
        </div>
      </form>
    </div>
  );
}
