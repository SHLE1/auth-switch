import { FileKey } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Account } from "../../shared/types";
import { AccountRow } from "./AccountRow";

interface AccountListProps {
  accounts: Account[];
  loading: boolean;
  switchingId: string | null;
  emptyKey?: string;
  onSwitch: (account: Account) => void;
  onEdit?: (account: Account) => void;
  onRename: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountList({
  accounts,
  loading,
  switchingId,
  emptyKey = "accountList.empty",
  onSwitch,
  onEdit,
  onRename,
  onDelete
}: AccountListProps): JSX.Element {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-full rounded-xl border border-dashed h-20 border-muted-foreground/30 bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (accounts.length === 0 || accounts.every((account) => account.is_current)) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed bg-card py-10 text-center">
        <FileKey size={18} className="text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground/70">{t(emptyKey)}</p>
      </div>
    );
  }

  const visibleAccounts = accounts.filter((account) => !account.is_current);
  const authAccounts = visibleAccounts.filter((account) => account.app !== "codex" || account.kind === "auth_json");
  const apiProfiles = visibleAccounts.filter((account) => account.app === "codex" && account.kind === "api_key");

  if (apiProfiles.length === 0) {
    return <AccountRows accounts={authAccounts} switchingId={switchingId} onSwitch={onSwitch} onEdit={onEdit} onRename={onRename} onDelete={onDelete} />;
  }

  return (
    <div className="space-y-5">
      {authAccounts.length > 0 && (
        <section className="space-y-2">
          <p className="mono-label px-1 text-[10px] text-muted-foreground/60">{t("accountList.authAccounts")}</p>
          <AccountRows accounts={authAccounts} switchingId={switchingId} onSwitch={onSwitch} onEdit={onEdit} onRename={onRename} onDelete={onDelete} />
        </section>
      )}
      <section className="space-y-2">
        <p className="mono-label px-1 text-[10px] text-muted-foreground/60">{t("accountList.apiProfiles")}</p>
        <AccountRows accounts={apiProfiles} switchingId={switchingId} onSwitch={onSwitch} onEdit={onEdit} onRename={onRename} onDelete={onDelete} />
      </section>
    </div>
  );
}

function AccountRows({
  accounts,
  switchingId,
  onSwitch,
  onEdit,
  onRename,
  onDelete
}: Omit<AccountListProps, "loading" | "emptyKey">): JSX.Element {
  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <AccountRow
          key={account.id}
          account={account}
          switchingId={switchingId}
          onSwitch={onSwitch}
          onEdit={onEdit}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
