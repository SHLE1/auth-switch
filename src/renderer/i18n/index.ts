import i18next from "i18next";
import { initReactI18next } from "react-i18next";
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

/** Persist language choice and change the active locale. */
export function setLanguage(lang: "en" | "zh"): void {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18next.changeLanguage(lang);
}

export default i18next;
