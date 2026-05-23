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
  confirmLabel = "Confirm",
  destructive = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
      <section className="w-full max-w-sm rounded-2xl border border-console-line bg-console-panel p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-console-text">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-console-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-console-line px-3 py-2 font-mono text-sm text-console-muted hover:text-console-text"
          >
            Cancel
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
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
