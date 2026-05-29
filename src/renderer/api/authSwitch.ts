import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Account,
  AccountUsageQuota,
  AuthSwitchApi,
  ClaudeProfileInput,
  CodexApiProfileInput,
  ImportResult,
  LiveAuthStatus,
  LiveClaudeStatus,
  ProfileEditData,
  SwitchResult
} from "../../shared/types";

export const authSwitch: AuthSwitchApi = {
  getAccounts: () => invoke<Account[]>("get_accounts"),
  getCurrentAccount: () => invoke<Account | null>("get_current_account"),
  getAccountUsageQuota: (id: string) => invoke<AccountUsageQuota>("get_account_usage_quota", { id }),
  switchAccount: (id: string) => invoke<SwitchResult>("switch_account", { id }),
  importAuthFile: () => invoke<ImportResult>("import_auth_file"),
  importAuthJsonContent: (content: string) => invoke<ImportResult>("import_auth_json_content", { content }),
  createApiProfile: (input: CodexApiProfileInput) => invoke<ImportResult>("create_api_profile", { input }),
  createClaudeProfile: (input: ClaudeProfileInput) => invoke<ImportResult>("create_claude_profile", { input }),
  importLiveAuthFile: (name?: string, setCurrent?: boolean) =>
    invoke<ImportResult>("import_live_auth_file", { name, setCurrent }),
  renameAccount: (id: string, name: string) => invoke<void>("rename_account", { id, name }),
  deleteAccount: (id: string) => invoke<void>("delete_account", { id }),
  nativeConfirm: (title: string, message: string, confirmLabel: string, cancelLabel: string) =>
    invoke<boolean>("native_confirm", { title, message, confirmLabel, cancelLabel }),
  nativeMessage: (title: string, message: string, buttonLabel: string) =>
    invoke<void>("native_message", { title, message, buttonLabel }),
  setLanguage: (locale: string) => invoke<void>("set_language", { locale }),
  getProfileEditData: (id: string) => invoke<ProfileEditData>("get_profile_edit_data", { id }),
  updateApiProfile: (id: string, input: CodexApiProfileInput) => invoke<ImportResult>("update_api_profile", { id, input }),
  updateClaudeProfile: (id: string, input: ClaudeProfileInput) => invoke<ImportResult>("update_claude_profile", { id, input }),
  getLiveAuthStatus: () => invoke<LiveAuthStatus>("get_live_auth_status"),
  getLiveClaudeStatus: () => invoke<LiveClaudeStatus>("get_live_claude_status"),
  dismissFirstRun: () => invoke<void>("dismiss_first_run"),
  shouldShowFirstRun: () => invoke<boolean>("should_show_first_run"),
  onAccountsChanged: (callback: () => void) => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen("accounts-changed", () => callback()).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlisten = nextUnlisten;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }
};
