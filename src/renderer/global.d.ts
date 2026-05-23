import type { AuthSwitchApi } from "../shared/types";

declare global {
  interface Window {
    authSwitch: AuthSwitchApi;
  }
}

export {};
