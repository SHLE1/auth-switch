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
  if (loading) {
    return <p className="rounded-xl border border-console-line p-4 font-mono text-sm text-console-muted">Loading accounts...</p>;
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-console-line p-4 text-sm leading-6 text-console-muted">
        No accounts imported yet. Add a Codex <span className="font-mono text-console-text">auth.json</span> to begin.
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
