import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account } from "../../shared/types";

interface RenameDialogProps {
  account: Account;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export function RenameDialog({ account, onCancel, onSave }: RenameDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(account.name);

  useEffect(() => {
    setName(account.name);
  }, [account]);

  const canSave = name.trim().length > 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-sm gap-3">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm">{t("rename.title")}</DialogTitle>
          <DialogDescription className="truncate font-mono text-[11px]">
            {account.email ?? account.id}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave(name.trim());
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-input" className="mono-label text-[10px] text-muted-foreground">
              {t("common.name")}
            </Label>
            <Input
              id="rename-input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <DialogFooter className="mt-4 gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
