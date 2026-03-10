import { getSavedSessions, removeSession, saveSession } from "./lib/storage.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Saver Starter installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      console.error(error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_SESSIONS":
      return getSavedSessions();
    case "SAVE_CURRENT_WINDOW":
      return saveCurrentWindow(message.payload?.name);
    case "DELETE_SESSION":
      return removeSession(message.payload?.sessionId);
    default:
      throw new Error("Unsupported message type.");
  }
}

async function saveCurrentWindow(customName) {
  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
  const now = new Date();
  const session = {
    id: crypto.randomUUID(),
    name: customName?.trim() || `Session ${now.toLocaleString()}`,
    createdAt: now.toISOString(),
    tabs: currentWindowTabs.map((tab) => ({
      title: tab.title || "Untitled Tab",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || ""
    }))
  };

  return saveSession(session);
}
