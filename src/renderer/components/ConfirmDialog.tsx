import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps): JSX.Element {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
    >
      <section className="w-full max-w-sm rounded-2xl border border-console-line bg-console-panel p-5 shadow-2xl">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-console-text">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-console-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-console-line px-3 py-2 font-mono text-sm text-console-muted hover:text-console-text"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg border px-3 py-2 font-mono text-sm transition ${
              destructive
                ? "border-console-red/60 bg-console-red/10 text-console-red hover:bg-console-red/20"
                : "border-console-green/60 bg-console-green/10 text-console-green hover:bg-console-green/20"
            }`}
          >
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}
