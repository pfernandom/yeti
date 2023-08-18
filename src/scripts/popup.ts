/// <reference types="chrome-types" />

import debounce from "lodash-es/debounce";
import {
  searchTab,
  setupCloseDuplicatedTabs,
  setupCloseNewTabs,
  setupSortAction,
  setupSortAndGroupAction,
} from "./tabs/actions";

const addResultListeners = debounce(() => {
  document.querySelectorAll(".search-result")?.forEach((sresult) => {
    sresult.addEventListener("click", async (ev) => {
      const target = ev.target as HTMLLIElement;
      const tabId = target.dataset.id ? parseInt(target.dataset.id) : null;

      if (tabId && !Number.isNaN(tabId)) {
        const maybeTab = await chrome.tabs.get(tabId);
        tabId && (await chrome.tabs.update(tabId, { active: true }));
        await chrome.windows.update(maybeTab.windowId, { focused: true });
      }
    });
  });
}, 300);

function renderTabResults(tabs: chrome.tabs.Tab[] | undefined) {
  const collator = new Intl.Collator();
  const preSortedTabs = tabs?.sort((a, b) =>
    collator.compare(a.title ?? "", b.title ?? "")
  );
  const sortedTabs = preSortedTabs?.sort((a, b) => {
    if (a.active) {
      return -1;
    }
    if (b.active) {
      return 1;
    }
    return 0;
  });

  const tabsContent = sortedTabs?.map(
    (tab) =>
      `<li class="search-result ${tab.active ? "active-tab" : ""}" data-id="${
        tab.id
      }">${tab.title} ${
        tab.active ? '<span class="active-batch">Active tab</span>' : ""
      }</li>`
  );

  const resultsContent = `<ul>${tabsContent?.join("")}</ul>`;
  return resultsContent;
}

async function getDefaultView() {
  const result = document.querySelector("#search-result");
  const tabs = await chrome.tabs.query({
    currentWindow: true,
  });
  if (result) {
    result.innerHTML = renderTabResults(tabs);
    addResultListeners();
  }
}

async function main() {
  await getDefaultView();

  const messages = document.querySelector("#messages");
  function renderMessage(msg: string) {
    if (messages) {
      messages.innerHTML = msg;
    }
  }

  setupSortAndGroupAction("#group");

  setupSortAction("#sort");

  setupCloseNewTabs("#closeNew");

  setupCloseDuplicatedTabs("#closeDuplicated", (tabs) => {
    renderMessage(`Deleted ${tabs.length} tabs`);
  });

  const input = document.querySelector("#tab-search") as HTMLInputElement;

  input.addEventListener("input", () => {
    const result = document.querySelector("#search-result");
    if (result) {
      result.innerHTML = "<div>Loading...</div>";
    }
  });

  searchTab("#tab-search", (tabs) => {
    const result = document.querySelector("#search-result");
    if (result) {
      result.innerHTML = renderTabResults(tabs);

      addResultListeners();
    }
  });
}

main();
