const sessionNameInput = document.querySelector("#session-name");
const saveButton = document.querySelector("#save-button");
const sessionCount = document.querySelector("#session-count");
const emptyState = document.querySelector("#empty-state");
const sessionList = document.querySelector("#session-list");
const template = document.querySelector("#session-item-template");

initialize().catch(showError);

saveButton.addEventListener("click", async () => {
  try {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    const response = await sendMessage("SAVE_CURRENT_WINDOW", {
      name: sessionNameInput.value
    });

    sessionNameInput.value = "";
    renderSessions(response);
  } catch (error) {
    showError(error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save current window";
  }
});

sessionList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  if (target.dataset.role !== "delete") {
    return;
  }

  try {
    const response = await sendMessage("DELETE_SESSION", {
      sessionId: target.dataset.sessionId
    });
    renderSessions(response);
  } catch (error) {
    showError(error);
  }
});

async function initialize() {
  const sessions = await sendMessage("GET_SESSIONS");
  renderSessions(sessions);
}

function renderSessions(sessions) {
  sessionList.textContent = "";
  sessionCount.textContent = String(sessions.length);
  emptyState.hidden = sessions.length > 0;

  for (const session of sessions) {
    const fragment = template.content.cloneNode(true);
    const name = fragment.querySelector(".session-name");
    const detail = fragment.querySelector(".session-detail");
    const deleteButton = fragment.querySelector("[data-role='delete']");

    name.textContent = session.name;
    detail.textContent = `${session.tabs.length} tabs • ${formatDate(session.createdAt)}`;
    deleteButton.dataset.sessionId = session.id;

    sessionList.appendChild(fragment);
  }
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown error."));
        return;
      }

      resolve(response.data);
    });
  });
}

function showError(error) {
  console.error(error);
  emptyState.hidden = false;
  emptyState.textContent = error.message || "Something went wrong.";
}
