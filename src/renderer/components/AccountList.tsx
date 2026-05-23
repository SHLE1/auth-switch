import { useTranslation } from "react-i18next";
import type { Account } from "../types";
import { AccountRow } from "./AccountRow";

interface AccountListProps {
  accounts: Account[];
  loading: boolean;
  onSwitch: (account: Account) => void;
  onRename: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountList({ accounts, loading, onSwitch, onRename, onDelete }: AccountListProps): JSX.Element {
  const { t } = useTranslation();

  if (loading) {
    return <p className="rounded-xl border border-console-line p-4 font-mono text-sm text-console-muted">{t("accountList.loading")}</p>;
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-console-line p-4 text-sm leading-6 text-console-muted">
        {t("accountList.empty")}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {accounts.map((account) => (
        <AccountRow
          key={account.id}
          account={account}
          onSwitch={onSwitch}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
