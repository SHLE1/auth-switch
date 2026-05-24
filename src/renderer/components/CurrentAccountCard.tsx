import { ShieldCheck, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import type { Account } from "../types";

interface CurrentAccountCardProps {
  account: Account | null;
}

export function CurrentAccountCard({ account }: CurrentAccountCardProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="mb-2.5 flex items-center gap-1.5 text-muted-foreground">
          <ShieldCheck size={13} />
          <span className="mono-label text-[11px]">{t("currentAccount.label")}</span>
        </div>

        {account ? (
          <div>
            <p className="truncate text-base font-semibold">{account.name}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {account.kind === "api_key"
                ? account.base_url ?? t("currentAccount.apiProfile")
                : account.email ?? t("currentAccount.emailUnavailable")}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <Terminal size={12} />
              <span>
                {account.kind === "api_key"
                  ? t("currentAccount.activeApiKey")
                  : t("currentAccount.activeAuth")}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-base font-semibold">{t("currentAccount.noAccount")}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {t("currentAccount.noAccountDesc")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
