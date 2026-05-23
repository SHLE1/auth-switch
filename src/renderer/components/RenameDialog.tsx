import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { Account } from "../types";

interface RenameDialogProps {
  account: Account;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export function RenameDialog({ account, onCancel, onSave }: RenameDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(account.name);
  const containerRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    setName(account.name);
  }, [account]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const canSave = name.trim().length > 0;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
    >
      <form
        className="w-full max-w-sm rounded-2xl border border-console-line bg-console-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave(name.trim());
        }}
      >
        <h2 id="rename-dialog-title" className="text-lg font-semibold text-console-text">
          {t("rename.title")}
        </h2>
        <p className="mt-2 truncate font-mono text-xs text-console-muted">{account.email ?? account.id}</p>
        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">{t("common.name")}</span>
          <input
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
          />
        </label>
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
            {t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
