import { Check, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Account } from "../types";

interface AccountRowProps {
  account: Account;
  onSwitch: (account: Account) => void;
  onRename: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountRow({ account, onSwitch, onRename, onDelete }: AccountRowProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <li className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Active indicator */}
        <div
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            account.is_current ? "border-foreground text-foreground" : "border-border"
          )}
        >
          {account.is_current && <Check size={12} strokeWidth={2.5} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{account.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {account.kind === "api_key"
                  ? account.base_url ?? t("currentAccount.apiProfile")
                  : account.email ?? t("currentAccount.emailUnavailable")}
              </p>
            </div>

            {account.is_current ? (
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-[11px]"
              >
                {t("accountRow.current")}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSwitch(account)}
                className="shrink-0 font-mono text-xs"
              >
                {t("accountRow.switch")}
              </Button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1">
            <Badge variant="secondary" className="font-mono text-[11px] text-muted-foreground">
              {account.kind === "api_key" ? t("accountRow.apiEnv") : "auth.json"}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRename(account)}
              className="h-6 gap-1 px-2 font-mono text-xs text-muted-foreground"
            >
              <Pencil size={11} />
              {t("accountRow.rename")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(account)}
              className="h-6 gap-1 px-2 font-mono text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={11} />
              {t("accountRow.delete")}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
