/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch */

/* global MailServices, BasePopup, FolderUtils, UIFontSize */
ChromeUtils.defineESModuleGetters(this, {
  MailServices: "resource:///modules/MailServices.sys.mjs",
  BasePopup: "resource:///modules/ExtensionPopups.sys.mjs",
  FolderUtils: "resource:///modules/FolderUtils.sys.mjs",
  UIFontSize: "resource:///modules/UIFontSize.sys.mjs"
});

this.quickmove = class extends ExtensionAPI {
  getAPI(context) {
    return {
      quickmove: {
        // bug 1840039 - messenger.folders.query API
        // bug 1945514 - allow differing between MRU/MRMTime
        // TB136 COMPAT
        async query({ recent, limit, canFileMessages }) {
          function* allFolders(root) {
            if (
              !root.isServer &&
              (canFileMessages === null || root.canFileMessages === canFileMessages)
            ) {
              yield root;
            }
            if (root.hasSubFolders) {
              for (let folder of root.subFolders) {
                yield* allFolders(folder);
              }
            }
          }

          let folders = [];

          for (let acct of MailServices.accounts.accounts) {
            if (acct.incomingServer) {
              folders = folders.concat([...allFolders(acct.incomingServer.rootFolder)]);
            }
          }

          if (recent) {
            let recentType = recent == "modified" ? "MRMTime" : "MRUTime";
            let recentFolders = FolderUtils.getMostRecentFolders(folders, limit || Infinity, recentType);
            folders = recentFolders.map(folder => context.extension.folderManager.convert(folder));
          }

          return folders;
        },

        // This sets the legacy shortcuts, will only keep this until the other bugs are fixed.
        setupLegacyShortcuts(enabled) {
          if (enabled) {
            context.extension.shortcuts.updateCommand({
              name: "move",
              shortcut: "Shift+M"
            });
            context.extension.shortcuts.updateCommand({
              name: "copy",
              shortcut: "Shift+Y"
            });
            context.extension.shortcuts.updateCommand({
              name: "goto",
              shortcut: "Shift+G"
            });
            context.extension.shortcuts.updateCommand({
              name: "tag",
              shortcut: "Shift+T"
            });
          } else {
            context.extension.shortcuts.resetCommand("move");
            context.extension.shortcuts.resetCommand("copy");
            context.extension.shortcuts.resetCommand("goto");
            context.extension.shortcuts.resetCommand("tag");
          }
        },

        // bug 1925836 - Extension popup font size does not adapt to Thunderbird font size
        async getUIFontSize() {
          return UIFontSize.size;
        },
      }
    };
  }
};
