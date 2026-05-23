import { useCallback, useEffect, useMemo, useState } from "react";
import type { Account } from "../types";

export function useAccounts(): {
  accounts: Account[];
  current: Account | null;
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
      const nextAccounts = await window.authSwitch.getAccounts();
      setAccounts(nextAccounts);
      setError(null);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return window.authSwitch.onAccountsChanged(() => {
      void refresh();
    });
  }, [refresh]);

  const current = useMemo(() => accounts.find((account) => account.is_current) ?? null, [accounts]);

  return { accounts, current, loading, error, setError, refresh };
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
