const STORAGE_KEY = "savedTabSessions";

export async function getSavedSessions() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

export async function saveSession(session) {
  const sessions = await getSavedSessions();
  const nextSessions = [session, ...sessions];

  await chrome.storage.local.set({
    [STORAGE_KEY]: nextSessions
  });

  return nextSessions;
}

export async function removeSession(sessionId) {
  const sessions = await getSavedSessions();
  const nextSessions = sessions.filter((session) => session.id !== sessionId);

  await chrome.storage.local.set({
    [STORAGE_KEY]: nextSessions
  });

  return nextSessions;
}
