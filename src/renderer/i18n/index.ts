import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { authSwitch } from "../api/authSwitch";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

const STORAGE_KEY = "auth-switch-lang";

const savedLang = localStorage.getItem(STORAGE_KEY) ?? "en";

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh }
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

// Sync current language preference to main process on startup so the tray
// menu reflects the user's language even before they change it in this session.
void authSwitch.setLanguage(savedLang);

/** Persist language choice, update the active locale, and sync to main process. */
export function setLanguage(lang: "en" | "zh"): void {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18next.changeLanguage(lang);
  void authSwitch.setLanguage(lang);
}

export default i18next;
