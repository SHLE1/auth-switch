export interface Account {
  id: string;
  app: "codex" | "claude";
  name: string;
  email: string | null;
  kind: "auth_json" | "api_key";
  base_url: string | null;
  model: string | null;
  is_current: boolean;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

export type CredentialStatus = "valid" | "expired" | "not_found" | "parse_error";

export interface QuotaTier {
  name: string;
  utilization: number;
  remaining: number;
  resetsAt: string | null;
}

export interface AccountUsageQuota {
  accountId: string;
  credentialStatus: CredentialStatus;
  credentialMessage: string | null;
  success: boolean;
  tiers: QuotaTier[];
  amount: number | null;
  unit: string | null;
  used: number | null;
  limit: number | null;
  unlimited: boolean;
  source: string | null;
  error: string | null;
  queriedAt: number | null;
}

export interface ProfileEditData {
  name: string;
  apiKey: string;
  baseUrl: string;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
}

export interface CodexApiProfileInput {
  name: string;
  apiKey: string;
  baseUrl: string;
  model?: string;
}

export interface ClaudeProfileInput {
  name: string;
  apiKey: string;
  apiKeyField?: "ANTHROPIC_AUTH_TOKEN" | "ANTHROPIC_API_KEY";
  baseUrl?: string;
  haikuModel?: string;
  sonnetModel?: string;
  opusModel?: string;
}

export interface SwitchResult {
  success: boolean;
  alreadyCurrent?: boolean;
  error?: string;
  account?: Account;
}

export interface ImportResult {
  success: boolean;
  cancelled?: boolean;
  duplicate?: boolean;
  sameEmailExists?: boolean;
  account?: Account;
  error?: string;
}

export interface LiveAuthStatus {
  exists: boolean;
  hash: string | null;
  email: string | null;
  path: string;
}

export interface LiveClaudeStatus {
  exists: boolean;
  path: string;
}

export interface AuthSwitchApi {
  getAccounts(): Promise<Account[]>;
  getCurrentAccount(): Promise<Account | null>;
  switchAccount(id: string): Promise<SwitchResult>;
  getAccountUsageQuota(id: string): Promise<AccountUsageQuota>;
  importAuthFile(): Promise<ImportResult>;
  importAuthJsonContent(content: string): Promise<ImportResult>;
  createApiProfile(input: CodexApiProfileInput): Promise<ImportResult>;
  createClaudeProfile(input: ClaudeProfileInput): Promise<ImportResult>;
  importLiveAuthFile(name?: string, setCurrent?: boolean): Promise<ImportResult>;
  renameAccount(id: string, name: string): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  nativeConfirm(title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean>;
  nativeMessage(title: string, message: string, buttonLabel: string): Promise<void>;
  setLanguage(locale: string): Promise<void>;
  getLiveAuthStatus(): Promise<LiveAuthStatus>;
  getLiveClaudeStatus(): Promise<LiveClaudeStatus>;
  getProfileEditData(id: string): Promise<ProfileEditData>;
  updateApiProfile(id: string, input: CodexApiProfileInput): Promise<ImportResult>;
  updateClaudeProfile(id: string, input: ClaudeProfileInput): Promise<ImportResult>;
  dismissFirstRun(): Promise<void>;
  shouldShowFirstRun(): Promise<boolean>;
  onAccountsChanged(callback: () => void): () => void;
}
