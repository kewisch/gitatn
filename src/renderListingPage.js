import { createSSRApp, h } from "vue";
import { renderToString } from "@vue/server-renderer";

function text(value, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function dateText(value) {
  return text(value, "Unknown");
}

function link(href, label, className) {
  if (!href) {
    return null;
  }
  return h("a", { href, class: className }, label);
}

function metadataItem(label, value, options = {}) {
  if (!value && !options.always) {
    return null;
  }
  const content = options.href
    ? h("a", { href: options.href }, value)
    : h("span", value || "Not provided");

  return h("div", { class: "meta-item" }, [
    h("dt", label),
    h("dd", content),
  ]);
}

function badge(label, className = "") {
  if (!label) {
    return null;
  }
  return h("span", { class: ["badge", className] }, label);
}

const ListingPage = {
  props: {
    addon: {
      type: Object,
      required: true,
    },
  },
  render() {
    const addon = this.addon;
    const hasScreenshots = addon.screenshots.length > 0;
    const hasTags = addon.tags.length > 0;
    const hasCategories = addon.categories.length > 0;
    const permissions = addon.permissions.length
      ? addon.permissions
      : ["This add-on does not request special permissions."];

    return h("div", { class: "page" }, [
      h("header", { class: "site-header" }, [
        h("div", { class: "header-inner" }, [
          h("a", { href: addon.homeUrl, class: "brand" }, [
            h("span", { class: "brand-mark" }, "TB"),
            h("span", { class: "brand-copy" }, [
              h("span", { class: "brand-product" }, "Thunderbird"),
              h("span", { class: "brand-title" }, "ADD-ONS"),
            ]),
          ]),
          h("nav", { class: "top-nav", "aria-label": "Add-on sections" }, [
            h("a", { href: addon.extensionsUrl, class: "active" }, "Extensions"),
            h("a", { href: addon.themesUrl }, "Themes"),
            h("a", { href: addon.moreUrl }, "More"),
          ]),
          h("form", { class: "search", role: "search" }, [
            h("label", { class: "visually-hidden", for: "search" }, "Find add-ons"),
            h("input", {
              id: "search",
              type: "search",
              placeholder: "Find add-ons",
              autocomplete: "off",
            }),
          ]),
        ]),
      ]),

      h("main", { class: "content" }, [
        h("article", { class: "listing-card" }, [
          h("section", { class: "hero" }, [
            h("div", { class: "identity" }, [
              addon.icon
                ? h("img", { src: addon.icon, alt: "", class: "addon-icon" })
                : h("div", { class: "addon-icon icon-fallback" }, addon.name.slice(0, 2)),
              h("div", { class: "title-block" }, [
                h("h1", addon.name),
                h("p", { class: "byline" }, [
                  "by ",
                  addon.author
                    ? h("a", { href: addon.authorUrl || "#", class: "author" }, addon.author)
                    : h("span", "Unknown author"),
                ]),
                h("p", { class: "summary" }, addon.summary),
                h("div", { class: "badges" }, [
                  addon.recommended ? badge("Recommended", "recommended") : null,
                  addon.compatibility ? badge(addon.compatibility, "compatibility") : null,
                ]),
              ]),
            ]),
            h("aside", { class: "install-panel" }, [
              h(
                "a",
                { href: addon.downloadUrl, class: "install-button" },
                `Add to Thunderbird`
              ),
            ]),
          ]),

          hasScreenshots
            ? h("section", { class: "section screenshots" }, [
                h("h2", "Screenshots"),
                h(
                  "div",
                  { class: "screenshot-strip" },
                  addon.screenshots.map((screenshot) =>
                    h("figure", { class: "screenshot" }, [
                      h("img", {
                        src: screenshot.src,
                        alt: screenshot.caption || `${addon.name} screenshot`,
                        loading: "lazy",
                      }),
                      screenshot.caption
                        ? h("figcaption", screenshot.caption)
                        : null,
                    ])
                  )
                ),
              ])
            : null,

          h("section", { class: "section details-grid" }, [
            h("div", { class: "about" }, [
              h("h2", "About this extension"),
              h("div", {
                class: "description",
                innerHTML: addon.descriptionHtml,
              }),
              link(addon.homepage, "Homepage", "read-more"),
            ]),
            h("aside", { class: "rating-panel rating-panel-empty", "aria-hidden": "true" }),
          ]),

          h("section", { class: "section permissions" }, [
            h("h2", "Permissions and data"),
            h("h3", "Required permissions:"),
            h(
              "ul",
              permissions.map((permission) => h("li", permission))
            ),
            h("h3", "Data collection:"),
            h("p", "The developer says this extension does not require data collection."),
          ]),

          h("section", { class: "section more-info" }, [
            h("h2", "More information"),
            h("dl", { class: "meta-grid" }, [
              metadataItem("Add-on Links", "Homepage", { href: addon.homepage }),
              metadataItem("Support", "Support site", { href: addon.supportUrl }),
              metadataItem("Add-on ID", addon.extensionId),
              metadataItem("Version", addon.version, { always: true }),
              metadataItem("Size", addon.size, { always: true }),
              metadataItem("Last updated", dateText(addon.lastUpdated), { always: true }),
              metadataItem("License", addon.license),
              metadataItem("Privacy Policy", "Read the privacy policy for this add-on", {
                href: addon.privacyPolicy,
              }),
              hasCategories ? metadataItem("Categories", addon.categories.join(", ")) : null,
              hasTags ? metadataItem("Tags", addon.tags.join(" · ")) : null,
            ]),
          ]),
        ]),
      ]),

      h("footer", { class: "site-footer" }, [
        h("div", { class: "footer-inner" }, [
          h("strong", { class: "moz" }, "moz://a"),
          h("nav", { "aria-label": "Footer links" }, [
            h("a", { href: "#" }, "Add-ons"),
            h("a", { href: "#" }, "Download Thunderbird"),
            h("a", { href: "#" }, "Community"),
            h("a", { href: "#" }, "Developer Hub"),
            h("a", { href: "#" }, "Privacy"),
          ]),
        ]),
      ]),
    ]);
  },
};

export async function renderListingPage(addon) {
  const app = createSSRApp(ListingPage, { addon });
  const body = await renderToString(app);
  return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(addon.name)} - Thunderbird Add-ons</title>
    <link rel="stylesheet" href="${escapeHtml(addon.siteCssUrl)}">
  </head>
  <body>${body}</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
