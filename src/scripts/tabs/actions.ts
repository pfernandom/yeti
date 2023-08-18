/// <reference types="chrome-types" />

import debounce from "lodash-es/debounce";
import memoize from "lodash-es/memoize";

interface TabGroups {
  [key: string]: chrome.tabs.Tab[];
}

export function setupSortAndGroupAction(btnQuerySelector: string) {
  setupSortAction(btnQuerySelector, async (tabs) => {
    const groupedTabs = tabs
      .filter((tab): tab is chrome.tabs.Tab => !!tab)
      .reduce((acc, el) => {
        const hostname = el.url ? new URL(el.url).hostname : "";
        if (acc[hostname]) {
          acc[hostname].push(el);
        } else {
          acc[hostname] = [el];
        }
        return acc;
      }, {} as TabGroups);

    Object.entries(groupedTabs).forEach(async ([groupName, tabs]) => {
      const tabIds = tabs
        .map((tab) => tab.id)
        .filter((tabId): tabId is number => !!(tabId ?? false));
      const [firstTab, ...restTabs] = tabIds;
      const group = await chrome.tabs.group({
        tabIds: [firstTab, ...restTabs],
      });
      await chrome.tabGroups.update(group, {
        title: groupName,
        collapsed: true,
      });
    });
  });
}

export function setupSortAction(
  btnQuerySelector: string,
  onSortComplete?: (tabs: (chrome.tabs.Tab | null)[]) => void
) {
  const button = document.querySelector(btnQuerySelector);
  if (!button) {
    console.warn(`Could not find button ${btnQuerySelector}`);
    return;
  }
  button.addEventListener("click", async (ev) => {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
    });

    // const ids= tabs.map(tab => tab.id)

    const collator = new Intl.Collator();
    const sortedTabs = tabs.sort((a, b) =>
      collator.compare(a.url ?? "", b.url ?? "")
    );

    const movedTabs = sortedTabs.map(async (tab, index) => {
      if (tab.id) {
        return (await chrome.tabs.move(tab.id, { index })) as chrome.tabs.Tab;
      } else {
        console.warn(`Tab with no ID`, tab);
        return null;
      }
    });

    const result = await Promise.all(movedTabs);

    onSortComplete?.call(null, result);
  });
}

const TAB_CACHE_TTL = 2000;

export function searchTab(
  inputQuerySelector: string,
  onSearchComplete?: (tab: chrome.tabs.Tab[] | undefined) => void
) {
  const input = document.querySelector(inputQuerySelector) as HTMLInputElement;

  const getAllTabs = memoize(async (timeStampe: number) => {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
    });
    return tabs;
  });

  let timeStamp = new Date().getTime();

  const findTab = debounce(async (query: string) => {
    if (Math.abs(new Date().getTime() - timeStamp) > TAB_CACHE_TTL) {
      timeStamp = new Date().getTime();
    }

    const tabs = await getAllTabs(timeStamp);
    const maybeTabs = tabs.filter(
      (tab) =>
        tab.title?.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
        tab.url?.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    );
    onSearchComplete?.call(null, maybeTabs);
  }, 100);

  input?.addEventListener("input", (ev) => {
    if (ev.target) {
      const input = ev.target as HTMLInputElement;
      return findTab(input.value);
    }
  });
}

function setupButtonAction(
  btnQuerySelector: string,
  action: (ev: Event, tabs: chrome.tabs.Tab[]) => void
) {
  const button = document.querySelector(btnQuerySelector);
  if (!button) {
    console.warn(`Could not find button ${btnQuerySelector}`);
    return;
  }
  button.addEventListener("click", async (ev) => {
    const tabs = await chrome.tabs.query({
      currentWindow: true,
    });

    action(ev, tabs);
  });
}

export function setupCloseNewTabs(btnQuerySelector: string) {
  setupButtonAction(btnQuerySelector, (ev, tabs) => {
    const unusedTabs = tabs.filter((tab) =>
      tab.url?.includes("chrome://newtab/")
    );
    unusedTabs.forEach(async (tab) => {
      try {
        console.log("Try to discard tab", tab);
        // chrome.tabs.discard(tab.id);
        if (tab.id) {
          chrome.tabs.remove([tab.id]);
        }
      } catch (err) {
        console.warn("Error discarding tab", err);
      }
    });
  });
}

export async function setupCloseDuplicatedTabs(
  btnQuerySelector: string,
  onComplete?: (deletedTabs: chrome.tabs.Tab[]) => void
) {
  setupButtonAction(btnQuerySelector, async (ev, tabs) => {
    const byUrl = tabs.reduce((acc, tab) => {
      if (!tab.url) {
        return acc;
      }
      if (acc[tab.url]) {
        acc[tab.url].push(tab);
      } else {
        acc[tab.url] = [tab];
      }
      return acc;
    }, {} as Record<string, chrome.tabs.Tab[]>);

    const removalResults = Object.values(byUrl).map(async (tabs) => {
      const [firstTab, ...restOfTabs] = tabs;

      await chrome.tabs.remove(
        restOfTabs
          .map((tab) => tab.id)
          .filter((id): id is number => !!(id ?? false))
      );

      return restOfTabs;
    });

    const results = (await Promise.all(removalResults)).flatMap((tabs) => tabs);

    onComplete?.call(null, results);
  });
}
