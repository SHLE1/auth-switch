import { Loader2, MoreHorizontal, Pencil, Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { Account } from "../../shared/types";

interface AccountRowProps {
  account: Account;
  switchingId: string | null;
  onSwitch: (account: Account) => void;
  onEdit?: (account: Account) => void;
  onRename: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountRow({
  account,
  switchingId,
  onSwitch,
  onEdit,
  onRename,
  onDelete
}: AccountRowProps): JSX.Element {
  const { t } = useTranslation();
  const isSwitching = switchingId === account.id;
  const isApi = account.kind === "api_key";
  const isClaude = account.app === "claude";
  const initial = account.name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border p-4 transition-all duration-300",
        "bg-card text-card-foreground",
        account.is_current
          ? "border-blue-500/60 shadow-sm shadow-blue-500/10"
          : "hover:border-blue-500/30 hover:shadow-sm"
      )}
    >
      {/* Gradient overlay for current item */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r to-transparent transition-opacity duration-500 pointer-events-none",
          account.is_current ? "from-blue-500/10 opacity-100" : "from-blue-500/10 opacity-0"
        )}
      />

      <div className="relative flex items-center justify-between gap-3">
        {/* Left: avatar + name + subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-semibold",
              account.is_current
                ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            {initial}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-h-[1.25rem]">
              <p className="truncate text-[13px] font-semibold leading-snug">{account.name}</p>
              {isApi && (
                <span className="inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  API
                </span>
              )}
              {isClaude && !isApi && (
                <span className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  claude
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {isApi
                ? account.base_url ?? t("currentAccount.apiProfile")
                : account.email ?? t("currentAccount.emailUnavailable")}
            </p>
          </div>
        </div>

        {/* Right: Switch/Current + always-visible three-dot menu */}
        <div className="flex shrink-0 items-center gap-2">
          {account.is_current ? (
            <span className="inline-flex items-center rounded-lg bg-blue-500/10 px-3 py-1.5 font-mono text-[11px] font-medium text-blue-600 dark:text-blue-400 tracking-wide">
              {t("accountRow.current")}
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isSwitching || !!switchingId}
              onClick={() => onSwitch(account)}
              className={cn(
                "h-8 px-3 font-mono text-[11px] tracking-wide",
                "active:scale-[0.97] transition-transform duration-100"
              )}
            >
              {isSwitching ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  {t("accountRow.switching")}
                </>
              ) : (
                t("accountRow.switch")
              )}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground/60 hover:text-foreground"
              >
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {isApi && onEdit && (
                <>
                  <DropdownMenuItem
                    onClick={() => onEdit(account)}
                    className="gap-2 font-mono text-xs"
                  >
                    <Settings size={12} />
                    {t("accountRow.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => onRename(account)}
                className="gap-2 font-mono text-xs"
              >
                <Pencil size={12} />
                {t("accountRow.rename")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(account)}
                className="gap-2 font-mono text-xs text-destructive focus:text-destructive"
              >
                <Trash2 size={12} />
                {t("accountRow.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
