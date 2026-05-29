import { useCallback, useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../../shared/errors";
import { authSwitch } from "../api/authSwitch";
import type { Account } from "../../shared/types";

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function useAccounts(): {
  accounts: Account[];
  codexAccounts: Account[];
  claudeAccounts: Account[];
  codexCurrent: Account | null;
  claudeCurrent: Account | null;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  refresh: () => Promise<void>;
} {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      if (!isTauriRuntime()) {
        const mockAccounts = (window as Window & { __AUTH_SWITCH_MOCK_ACCOUNTS__?: Account[] }).__AUTH_SWITCH_MOCK_ACCOUNTS__ ?? [];
        setAccounts(mockAccounts);
        setError(null);
        return;
      }
      const nextAccounts = await authSwitch.getAccounts();
      setAccounts(nextAccounts);
      setError(null);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!isTauriRuntime()) return;
    return authSwitch.onAccountsChanged(() => {
      void refresh();
    });
  }, [refresh]);

  const codexAccounts = useMemo(() => accounts.filter((account) => account.app === "codex"), [accounts]);
  const claudeAccounts = useMemo(() => accounts.filter((account) => account.app === "claude"), [accounts]);
  const codexCurrent = useMemo(
    () => codexAccounts.find((account) => account.is_current) ?? null,
    [codexAccounts]
  );
  const claudeCurrent = useMemo(
    () => claudeAccounts.find((account) => account.is_current) ?? null,
    [claudeAccounts]
  );

  return {
    accounts,
    codexAccounts,
    claudeAccounts,
    codexCurrent,
    claudeCurrent,
    loading,
    error,
    setError,
    refresh
  };
}
