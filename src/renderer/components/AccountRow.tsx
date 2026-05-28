import { Loader2, MoreHorizontal, Pencil, Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={cn(
          "size-3.5 shrink-0 rounded-full border transition-colors duration-150",
          account.is_current
            ? "border-foreground bg-foreground animate-dot-fill"
            : "border-border bg-transparent"
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-snug">{account.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {account.kind === "api_key"
                ? account.base_url ?? t("currentAccount.apiProfile")
                : account.email ?? t("currentAccount.emailUnavailable")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
              {account.kind === "api_key" ? t("accountRow.apiEnv") : "auth.json"}
            </Badge>

            {account.is_current ? (
              <Badge
                variant="secondary"
                className="inline-flex h-7 min-w-[4.75rem] justify-center px-2.5 font-mono text-xs"
              >
                {t("accountRow.current")}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isSwitching || !!switchingId}
                onClick={() => onSwitch(account)}
                className={cn(
                  "h-7 min-w-[4.75rem] px-2.5 font-mono text-xs",
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
                  className="size-7 text-muted-foreground"
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {account.kind === "api_key" && onEdit && (
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
    </li>
  );
}
