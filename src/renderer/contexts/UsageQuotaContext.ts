import { createContext, useContext } from "react";
import type { AccountUsageQuota } from "../../shared/types";

export interface UsageQuotaState {
  quota: AccountUsageQuota | null;
  loading: boolean;
  error: string | null;
}

export interface UsageQuotaContextValue {
  getState: (accountId: string) => UsageQuotaState;
  refreshAccount: (accountId: string) => Promise<void>;
}

export const EMPTY_USAGE_QUOTA_STATE: UsageQuotaState = {
  quota: null,
  loading: false,
  error: null
};

export const UsageQuotaContext = createContext<UsageQuotaContextValue | null>(null);

export function useUsageQuotaContext(): UsageQuotaContextValue | null {
  return useContext(UsageQuotaContext);
}
