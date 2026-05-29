import { AlertCircle, Clock, RefreshCw } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Account, AccountUsageQuota, QuotaTier } from "../../shared/types";
import { cn } from "@/lib/utils";

import { useUsageQuotaContext } from "../contexts/UsageQuotaContext";
interface AccountUsageQuotaViewProps {
  account: Account;
  inline?: boolean;
}

const TIER_KEYS: Record<string, string> = {
  five_hour: "usage.fiveHour",
  seven_day: "usage.sevenDay"
};

export function AccountUsageQuotaView({ account, inline = false }: AccountUsageQuotaViewProps): JSX.Element | null {
  const { t } = useTranslation();
  const usageQuotaContext = useUsageQuotaContext();
  const usageState = usageQuotaContext?.getState(account.id);
  const quota = usageState?.quota ?? null;
  const loading = usageState?.loading ?? false;
  const error = usageState?.error ?? null;
  const now = Date.now();

  const shouldRender = account.app === "codex" || account.app === "claude";
  const loadQuota = useCallback(async () => {
    if (!shouldRender) return;
    await usageQuotaContext?.refreshAccount(account.id);
  }, [account.id, shouldRender, usageQuotaContext]);

  const visibleTiers = useMemo(() => quota?.tiers.filter((tier) => tier.name !== "seven_day_sonnet") ?? [], [quota]);

  if (!shouldRender) return null;

  if (!quota && !error && !loading) {
    if (!account.is_current) {
      return (
        <button
          type="button"
          onClick={() => void loadQuota()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={10} />
          {t("usage.check")}
        </button>
      );
    }
    return null;
  }

  if (error || quota?.error) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2 text-[11px] text-destructive", !inline && "mt-2")}> 
        <AlertCircle size={12} />
        <span className="truncate">{error ?? quota?.error ?? t("usage.queryFailed")}</span>
        <RefreshButton loading={loading} onClick={loadQuota} label={t("usage.refresh")} />
      </div>
    );
  }

  if (quota && !quota.success && quota.credentialStatus === "not_found") return null;

  if (quota && visibleTiers.length === 0 && quota.amount == null && !loading) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground", !inline && "mt-2")}>
        <span>{quota.credentialMessage ?? t("usage.unavailable")}</span>
        <RefreshButton loading={loading} onClick={loadQuota} label={t("usage.refresh")} />
      </div>
    );
  }

  if (inline) {
    return (
      <div className="min-w-[270px] max-w-[330px] flex-1 space-y-1.5 px-1">
        <div className="flex items-center justify-end gap-1.5">
          {quota?.queriedAt && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Clock size={10} />
              {formatRelativeTime(quota.queriedAt, now, t)}
            </span>
          )}
          <RefreshButton loading={loading} onClick={loadQuota} label={t("usage.refresh")} compact />
        </div>
        {quota?.amount != null && <BalanceLine quota={quota} compact />}
        {visibleTiers.map((tier) => (
          <TierBar key={tier.name} tier={tier} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label text-[10px] text-muted-foreground/70">{t("usage.title")}</p>
        <div className="flex items-center gap-2">
          {quota?.queriedAt && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Clock size={10} />
              {formatRelativeTime(quota.queriedAt, now, t)}
            </span>
          )}
          <RefreshButton loading={loading} onClick={loadQuota} label={t("usage.refresh")} />
        </div>
      </div>
      {quota?.amount != null && <BalanceLine quota={quota} />}
      {visibleTiers.map((tier) => (
        <TierBar key={tier.name} tier={tier} />
      ))}
    </div>
  );
}


function BalanceLine({ quota, compact = false }: { quota: AccountUsageQuota; compact?: boolean }): JSX.Element {
  const { t } = useTranslation();
  const unit = quota.unit ?? "USD";
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className={cn("grid items-baseline gap-2 text-[11px]", compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[88px_minmax(0,1fr)]")}>
        <span className="font-medium text-foreground">{t("usage.apiBalance")}</span>
        <span className="min-w-0 truncate font-mono text-muted-foreground">
          {t("usage.balanceRemaining", { amount: formatAmount(quota.amount), unit })}
          {quota.limit != null ? ` · ${t("usage.balanceLimit", { amount: formatAmount(quota.limit), unit })}` : ""}
        </span>
      </div>
      {quota.limit != null && quota.limit > 0 && quota.amount != null && (
        <div className={cn("grid items-center gap-2", compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[88px_minmax(0,1fr)]")}>
          <span aria-hidden="true" />
          <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1" : "h-1.5")}>
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.max(0, Math.min(100, (quota.amount / quota.limit) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
function RefreshButton({ loading, onClick, label, compact = false }: { loading: boolean; onClick: () => void; label: string; compact?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick()}
      disabled={loading}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50", compact ? "size-5" : "size-6")}
      title={label}
    >
      <RefreshCw size={compact ? 10 : 12} className={loading ? "animate-spin" : ""} />
    </button>
  );
}
function TierBar({ tier, compact = false }: { tier: QuotaTier; compact?: boolean }): JSX.Element {
  const { t } = useTranslation();
  const reset = formatResetTime(tier.resetsAt, t);
  const remaining = Math.max(0, Math.min(100, tier.remaining));
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className={cn("grid items-baseline gap-2 text-[11px]", compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[88px_minmax(0,1fr)]")}>
        <span className="font-medium text-foreground">{t(TIER_KEYS[tier.name] ?? "usage.window", { name: tier.name })}</span>
        <span className="min-w-0 truncate font-mono text-muted-foreground">
          {t("usage.remainingLong", { percent: formatPercent(tier.remaining) })}
          {reset ? ` · ${reset}` : ""}
        </span>
      </div>
      <div className={cn("grid items-center gap-2", compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[88px_minmax(0,1fr)]")}>
        <span aria-hidden="true" />
        <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1" : "h-1.5")}>
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${remaining}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
}

function formatResetTime(resetsAt: string | null, t: (key: string, options?: Record<string, string | number>) => string): string | null {
  if (!resetsAt) return null;
  const diffMs = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return t("usage.resetSoon");
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const time = days > 0 ? `${days}d${hours % 24}h` : hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`;
  return t("usage.resetsIn", { time });
}

function formatRelativeTime(timestamp: number, now: number, t: (key: string, options?: { count?: number }) => string): string {
  const diff = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diff < 60) return t("usage.justNow");
  if (diff < 3_600) return t("usage.minutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 86_400) return t("usage.hoursAgo", { count: Math.floor(diff / 3_600) });
  return t("usage.daysAgo", { count: Math.floor(diff / 86_400) });
}
