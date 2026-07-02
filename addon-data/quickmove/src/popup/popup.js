/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch */

import { RootNode } from "../common/foldernode.js";
import { DEFAULT_PREFERENCES, getValidatedFolders, isAltMode } from "../common/util.js";

const ALL_ACTIONS = ["move", "copy", "goto", "tag"];

let enabledActions = {
  move: true,
  copy: true,
  goto: true,
  tag: true
};

function formatFolderPath(folderNode) {
  return folderNode.fullNameParts.filter((val) => {
    return val !== "" && val != "[Gmail]" && val != "[Google Mail]";
  });
}

async function getComposeDestinationFolderId(composeTabId) {
  let details = await browser.compose.getComposeDetails(composeTabId);
  return details?.overrideDefaultFccFolderId || null;
}

function updateComposeDestinationInfo(rootNode, folderId, showFolderPath) {
  let infoNode = document.getElementById("compose-destination-info");
  let iconNode = document.getElementById("compose-destination-icon");
  let nameNode = document.getElementById("compose-destination-name");
  let pathNode = document.getElementById("compose-destination-path");
  let compact = document.documentElement.hasAttribute("compact");

  let folderNode = folderId ? rootNode.folderNodes.find(node => node.id == folderId) : null;
  iconNode.className = "";

  if (folderNode) {
    let pathParts = formatFolderPath(folderNode);
    iconNode.classList.add("folder-type-" + (folderNode.type || "folder"));

    if (compact && showFolderPath) {
      nameNode.textContent = pathParts.slice().reverse().join("\u200B\u2190");
      pathNode.textContent = "";
      pathNode.removeAttribute("title");
      pathNode.classList.add("hidden");
    } else {
      nameNode.textContent = folderNode.name;
      let folderPath = showFolderPath ? pathParts.slice(0, -1).join(" \u2192 ") : "";
      pathNode.textContent = folderPath;
      pathNode.title = folderPath;
      pathNode.classList.toggle("hidden", !folderPath);
    }

    nameNode.title = pathParts.join(" \u2192 ");
  } else {
    iconNode.classList.add("folder-type-folder");
    nameNode.textContent = browser.i18n.getMessage("composeDestinationDefaultFolder");
    nameNode.removeAttribute("title");
    pathNode.textContent = "";
    pathNode.removeAttribute("title");
    pathNode.classList.add("hidden");
  }

  infoNode.classList.remove("hidden");
}

function getAccountIdFromFolderId(folderId) {
  if (typeof folderId != "string" || !folderId.includes("://")) {
    return null;
  }
  return folderId.split("://")[0];
}

function setup_localization() {
  for (let node of document.querySelectorAll("[data-l10n-id]")) {
    let l10nid = node.getAttribute("data-l10n-id");
    node.textContent = browser.i18n.getMessage(l10nid);
  }
}

function switchList(action) {
  let folderList = document.getElementById("folder-list");
  let tagList = document.getElementById("tag-list");

  if (action == "tag") {
    tagList.style.display = "revert-layer";
    folderList.style.display = "none";
    return tagList;
  } else {
    folderList.navigateOnly = action == "goto";
    folderList.style.display = "revert-layer";
    tagList.style.display = "none";
    return folderList;
  }
}

async function load() {
  let fontSize = await messenger.quickmove.getUIFontSize();
  window.document.documentElement.style.setProperty("font-size", `${fontSize}px`);

  let {
    maxRecentFolders, showFolderPath, skipArchive, layout, defaultFolderSetting, migratedShiftArrow,
    recentStrategy, partialMatchFullPath, searchAccountName
  } = await browser.storage.local.get(DEFAULT_PREFERENCES);

  if (layout == "wide" || (layout == "auto" && window.outerWidth > 1400)) {
    document.documentElement.removeAttribute("compact");
    document.getElementById("folder-list").removeAttribute("compact");
    document.getElementById("tag-list").removeAttribute("compact");
  }
  document.body.style.display = "revert-layer";

  setup_localization();

  // hide action buttons
  let operationPrefs = await browser.storage.local.get({
    operationMenuItemsMove: DEFAULT_PREFERENCES.operationMenuItemsMove,
    operationMenuItemsCopy: DEFAULT_PREFERENCES.operationMenuItemsCopy,
    operationMenuItemsGoto: DEFAULT_PREFERENCES.operationMenuItemsGoto,
    operationMenuItemsTag: DEFAULT_PREFERENCES.operationMenuItemsTag
  });
  enabledActions.move = operationPrefs.operationMenuItemsMove;
  enabledActions.copy = operationPrefs.operationMenuItemsCopy;
  enabledActions.goto = operationPrefs.operationMenuItemsGoto;
  enabledActions.tag = operationPrefs.operationMenuItemsTag;

  if (!enabledActions.move) {
    document.querySelector("label[for='action-move']").style.display = "none";
    document.querySelector("#action-move").style.display = "none";
  }
  if (!enabledActions.copy) {
    document.querySelector("label[for='action-copy']").style.display = "none";
    document.querySelector("#action-copy").style.display = "none";
  }
  if (!enabledActions.goto) {
    document.querySelector("label[for='action-goto']").style.display = "none";
    document.querySelector("#action-goto").style.display = "none";
  }
  if (!enabledActions.tag) {
    document.querySelector("label[for='action-tag']").style.display = "none";
    document.querySelector("#action-tag").style.display = "none";
  }

  let params = new URLSearchParams(window.location.search);

  let action = params.get("action") || "move";
  document.querySelector(`.action-buttons input[value="${action}"]`).checked = true;

  let actions = new Set(ALL_ACTIONS);

  for (let allowedAction of (params.get("allowed") || "move,copy,goto,tag").split(",")) {
    actions.delete(allowedAction);
  }

  for (let hideaction of actions.values()) {
    document.querySelector(`label[for='action-${hideaction}']`).remove();
    document.querySelector(`#action-${hideaction}`).remove();
  }

  if (ALL_ACTIONS.length - actions.size == 1) {
    document.querySelector(".action-buttons").classList.add("hide");
  }

  // Setup folder list
  let tags = await browser.messages.tags.list();
  let accounts = await browser.accounts.list(true);

  let [currentTab] = await browser.tabs.query({ currentWindow: true, active: true });
  let currentFolderId = null;
  let currentFolderAccountId = null;

  if (currentTab?.type == "messageDisplay") {
    let messageList = await browser.messageDisplay.getDisplayedMessages(currentTab.id);
    let currentMessage = messageList?.messages?.[0] || null;
    currentFolderId = currentMessage?.folderId || null;
    currentFolderAccountId = getAccountIdFromFolderId(currentFolderId);
  } else if (currentTab?.type == "mail") {
    let [currentMailTab] = await browser.mailTabs.query({ active: true, currentWindow: true });
    currentFolderId = currentMailTab?.displayedFolderId || null;
    currentFolderAccountId = getAccountIdFromFolderId(currentFolderId);
  }

  if (currentFolderAccountId) {
    let currentAccountIndex = accounts.findIndex(account => account.id === currentFolderAccountId);
    if (currentAccountIndex >= 0) {
      accounts.unshift(...accounts.splice(currentAccountIndex, 1));
    }
  }

  let tagFolders = (await Promise.all(tags.map(async tag => {
    try {
      let folder = await messenger.folders.getTagFolder(tag.key);
      folder.color = tag.color;
      folder.subFolders = [];
      return folder;
    } catch (e) {
      // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1939403
      console.error(`Could not get tag folder ${tag.key}`);
      return null;
    }
  }))).filter(Boolean);

  let unifiedFolderTypes = ["inbox", "drafts", "sent", "trash", "templates", "archives", "junk"];

  let unifiedFolders = (await Promise.all(unifiedFolderTypes.map(async key => {
    try {
      let folder = await messenger.folders.getUnifiedFolder(key);
      folder.subFolders = [];
      return folder;
    } catch (e) {
      // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1939403
      console.error(`Could not get unified folder ${key}`);
      return null;
    }
  }))).filter(Boolean);

  let rootNode = new RootNode({ accounts, skipArchive, tagFolders, unifiedFolders });

  let excludedFolders = await getValidatedFolders(rootNode, "excludedFolders");
  let excludeSet = new Set(excludedFolders.map(folder => folder.id));
  if (currentFolderId) {
    excludeSet.add(currentFolderId);
  }

  let defaultFolders;

  if (defaultFolderSetting == "recent") {
    let folderList;
    // Unfortuantely the built-in API has some performance issues with large folder lists. Revert
    // back to the experiment for now.
    // if (majorVersion < 137) {
    // TB136 COMPAT

    folderList = await browser.quickmove.query({ recent: recentStrategy, limit: maxRecentFolders, canFileMessages: true });

    // } else {
    //   let lastProperty = recentStrategy == "modified" ? "lastUsedAsDestination" : "lastUsed";
    //   folderList = await browser.folders.query({
    //     limit: browser.folders.DEFAULT_MOST_RECENT_LIMIT,
    //     [lastProperty]: { recent: true },
    //     sort: lastProperty,
    //     canAddMessages: true
    //   });
    // }

    defaultFolders = rootNode.fromList(folderList).folderNodes;
  } else if (defaultFolderSetting == "specific") {
    defaultFolders = await getValidatedFolders(rootNode, "defaultFolders");
  } else {
    defaultFolders = null;
  }

  let folderList = document.getElementById("folder-list");
  folderList.initItems(rootNode.folderNodes, defaultFolders, showFolderPath, excludeSet, partialMatchFullPath, searchAccountName);
  folderList.ignoreFocus = true;

  if (currentTab?.type == "messageCompose") {
    let composeFolderId = await getComposeDestinationFolderId(currentTab.id).catch((e) => {
      console.error("Could not determine compose destination folder", e);
      return null;
    });
    updateComposeDestinationInfo(rootNode, composeFolderId, showFolderPath);
  }

  folderList.addEventListener("item-selected", async (event) => {
    let { folder, altMode } = event.detail;

    if (currentTab?.type == "messageCompose") {
      await browser.compose.setComposeDetails(currentTab.id, { overrideDefaultFccFolderId: folder.id });
      window.close();
      return;
    }

    let operation = document.querySelector("input[name='action']:checked").value;

    if (operation == "move" || operation == "copy") {
      await browser.runtime.sendMessage({
        action: "processSelectedMessages",
        folder: folder,
        operation: operation,
        goToFolder: altMode
      });
    } else if (operation == "goto") {
      let [tab] = await browser.tabs.query({ currentWindow: true, active: true });

      try {
        if (altMode) {
          await browser.mailTabs.create({ displayedFolderId: folder.id });
        } else {
          await browser.mailTabs.update(tab.id, { displayedFolderId: folder.id });
        }
      } catch (e) {
        if (e.message == "Requested folder is not viewable in any of the enabled folder modes") {
          document.getElementById("tags-view-missing-warning").classList.remove("hidden");
          return;
        }
        console.error(e);
      }
    }
    window.close();
  });

  // Setup tag list
  let tagList = document.getElementById("tag-list");
  tagList.ignoreFocus = true;
  tagList.initItems(tags, null);
  tagList.addEventListener("item-selected", async (event) => {
    await browser.runtime.sendMessage({ action: "processSelectedMessages", tag: event.detail.folder.key, tagName: event.detail.folder.tag, operation: "tag" });
    window.close();
  });

  document.querySelector(".action-buttons").addEventListener("click", (event) => {
    switchList(event.target.value).focusSearch();
  });

  if (migratedShiftArrow) {
    document.querySelector("#meta-action-warning").classList.add("migrated");
  } else {
    document.querySelector("#meta-action-warning .close").addEventListener("click", (event) => {
      browser.storage.local.set({ migratedShiftArrow: true });
      document.querySelector("#meta-action-warning").classList.add("migrated", "hidden");
    });
  }

  document.body.addEventListener("mousemove", () => {
    folderList.ignoreFocus = false;
    tagList.ignoreFocus = false;
  }, { once: true });

  if (params.get("window") == "true") {
    browser.windows.update(browser.windows.WINDOW_ID_CURRENT, { width: document.body.clientWidth });
    document.getElementById("window-warning").classList.remove("hidden");
  }

  switchList(action).focusSearch();
}

function keydown(event) {
  if (event.key == "Escape") {
    window.close();
  } else if (event.key == "ArrowLeft" || event.key == "ArrowRight") {
    let direction = event.key == "ArrowLeft" ? -1 : 1;
    if (!isAltMode(event)) {
      let metaActionWarning = document.getElementById("meta-action-warning");
      if (!event.shiftKey && !metaActionWarning.classList.contains("migrated")) {
        metaActionWarning.classList.remove("hidden");
      }
      return;
    }
    document.getElementById("meta-action-warning").classList.add("hidden");

    event.preventDefault();
    event.stopPropagation();

    let params = new URLSearchParams(window.location.search);
    let allowedActions = (params.get("allowed") || "move,copy").split(",");
    let sequence = allowedActions.filter(action => enabledActions[action]);
    if (getComputedStyle(document.documentElement).direction == "rtl") {
      direction *= -1;
    }

    let checked = document.querySelector(".action-buttons input:checked");
    let nextIdx = sequence.indexOf(checked.value) + direction;
    let action = sequence[Math.max(0, Math.min(nextIdx, sequence.length - 1))];
    document.querySelector(`.action-buttons input[value="${action}"]`).checked = true;

    let currentList = event.target;
    let targetList = switchList(action);

    if (currentList != targetList || event.originalTarget == currentList.search) {
      targetList.focusSearch();
    }
  }
}

function keypress(event) {
  if (!event.originalTarget.classList.contains("search-input")) {
    event.preventDefault();
  }
}

window.addEventListener("keypress", keypress);
window.addEventListener("keydown", keydown, { capture: true });
window.addEventListener("DOMContentLoaded", load, { once: true });
