export interface Account {
  id: string;
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

export interface CodexApiProfileInput {
  name: string;
  apiKey: string;
  baseUrl: string;
  model?: string;
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

export interface AuthSwitchApi {
  getAccounts(): Promise<Account[]>;
  getCurrentAccount(): Promise<Account | null>;
  switchAccount(id: string): Promise<SwitchResult>;
  importAuthFile(): Promise<ImportResult>;
  createApiProfile(input: CodexApiProfileInput): Promise<ImportResult>;
  importLiveAuthFile(name?: string, setCurrent?: boolean): Promise<ImportResult>;
  renameAccount(id: string, name: string): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  getLiveAuthStatus(): Promise<LiveAuthStatus>;
  dismissFirstRun(): Promise<void>;
  shouldShowFirstRun(): Promise<boolean>;
  onAccountsChanged(callback: () => void): () => void;
}
