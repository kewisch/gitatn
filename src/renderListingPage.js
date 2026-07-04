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
            h("img", { src: addon.siteLogoUrl, alt: "Thunderbird", class: "brand-logo" }),
            h("span", { class: "brand-copy" }, [
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
        h("div", { class: "footer-primary footer-site-nav" }, [
          h("a", { href: addon.homeUrl, class: "footer-brand", "aria-label": "Thunderbird" }, [
            h("img", { src: addon.thunderbirdWordmarkUrl, alt: "", class: "footer-brand-wordmark" }),
          ]),
          h("nav", { class: "footer-support-links", "aria-label": "Support links" }, [
            h("a", { href: "https://status.tb.pro/" }, "Status"),
            h("span", { "aria-hidden": "true" }, "|"),
            h("a", { href: "https://support.tb.pro/" }, "Need help? Visit Support"),
            h("span", { "aria-hidden": "true" }, "|"),
            h("a", { href: "https://ideas.tb.pro/" }, "Ideas?"),
          ]),
        ]),
        h("div", { class: "footer-primary footer-legal-block" }, [
          h("a", { href: "https://www.mozilla.org/", class: "footer-mozilla", "aria-label": "Mozilla" }, [
            h("img", { src: addon.mozillaLogoUrl, alt: "", class: "footer-mozilla-logo" }),
          ]),
          h("div", { class: "footer-legal-content" }, [
            h("nav", { class: "footer-legal-links", "aria-label": "Legal links" }, [
              h("a", { href: "https://tb.pro/en-US/privacy" }, "Privacy Policy"),
              h("a", { href: "https://tb.pro/en-US/terms" }, "Legal"),
              h("a", { href: "https://www.mozilla.org/en-US/about/legal/report-infringement/" }, "Send DMCA Notice"),
              h("a", { href: "https://www.mozilla.org/about/legal/fraud-report/" }, "Report Fraud"),
              h("a", { href: "https://www.mozilla.org/about/governance/policies/participation/" }, "Participation Guidelines"),
            ]),
            h("p", [
              "Thunderbird is part of ",
              h("a", { href: "https://blog.thunderbird.net/2020/01/thunderbirds-new-home/" }, "MZLA Technologies Corporation"),
              ", a wholly owned subsidiary of the not-for-profit Mozilla.org.",
            ]),
            h("p", [
              "Portions of this content are ©1998-2026 by individual contributors. Content available under a ",
              h("a", { href: "https://www.mozilla.org/foundation/licensing/website-content/" }, "Creative Commons license"),
              ".",
            ]),
            h("p", [
              h("a", { href: "https://github.com/thunderbird/thunderbird-website" }, "Contribute to this site"),
            ]),
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
