const LOCALE_STORAGE_KEY = "tabSaverLocale";
const SUPPORTED_LOCALES = ["en", "zh_CN"];
const messageCache = new Map();

export function getSupportedLocales() {
  return [...SUPPORTED_LOCALES];
}

export function normalizeLocale(locale) {
  if (!locale) {
    return null;
  }

  const normalized = String(locale).replace("-", "_").toLowerCase();
  if (normalized.startsWith("zh")) {
    return "zh_CN";
  }

  return "en";
}

export async function getStoredLocale() {
  const result = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
  return normalizeLocale(result[LOCALE_STORAGE_KEY]);
}

export async function setStoredLocale(locale) {
  const normalized = normalizeLocale(locale) || "en";
  await chrome.storage.local.set({
    [LOCALE_STORAGE_KEY]: normalized
  });
  return normalized;
}

export async function getTranslator(preferredLocale) {
  const locale = normalizeLocale(preferredLocale) || (await getStoredLocale()) || normalizeLocale(chrome.i18n.getUILanguage()) || "en";
  const messages = await loadMessages(locale);

  return {
    locale,
    t(key, substitutions = []) {
      return translate(messages, key, substitutions);
    }
  };
}

function translate(messages, key, substitutions = []) {
  const entry = messages[key];
  if (!entry?.message) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  let message = entry.message;
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];

  if (entry.placeholders) {
    for (const [placeholderName, placeholder] of Object.entries(entry.placeholders)) {
      const indexMatch = placeholder.content?.match(/\$(\d+)/);
      const valueIndex = indexMatch ? Number(indexMatch[1]) - 1 : -1;
      const replacement = valueIndex >= 0 ? String(values[valueIndex] ?? "") : "";
      const token = new RegExp(`\\$${placeholderName.toUpperCase()}\\$`, "g");
      message = message.replace(token, replacement);
    }
  }

  return message;
}

async function loadMessages(locale) {
  if (messageCache.has(locale)) {
    return messageCache.get(locale);
  }

  const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
  if (!response.ok) {
    throw new Error(`Failed to load locale: ${locale}`);
  }

  const messages = await response.json();
  messageCache.set(locale, messages);
  return messages;
}
