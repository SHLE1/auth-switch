import { FileKey } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import type { Account } from "../types";
import { AccountRow } from "./AccountRow";

interface AccountListProps {
  accounts: Account[];
  loading: boolean;
  switchingId: string | null;
  onSwitch: (account: Account) => void;
  onRename: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountList({
  accounts,
  loading,
  switchingId,
  onSwitch,
  onRename,
  onDelete,
}: AccountListProps): JSX.Element {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="rounded-md border divide-y">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <span className="size-3.5 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-8 text-center">
        <FileKey size={20} className="text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">{t("accountList.empty")}</p>
      </div>
    );
  }

  return (
    <ul className="rounded-md border divide-y">
      {accounts.map((account, i) => (
        <AccountRow
          key={account.id}
          account={account}
          switchingId={switchingId}
          onSwitch={onSwitch}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
