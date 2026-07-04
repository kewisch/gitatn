import { promises as fs } from "node:fs";

const listingTemplatePath = new URL("./templates/listing-page.html", import.meta.url);

function text(value, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function dateText(value) {
  return text(value, "Unknown");
}

function link(href, label, className) {
  if (!href) {
    return "";
  }
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  return `<a href="${escapeHtml(href)}"${classAttribute}>${escapeHtml(label)}</a>`;
}

function metadataItem(label, value, options = {}) {
  if (!value && !options.always) {
    return "";
  }
  const content = options.href
    ? `<a href="${escapeHtml(options.href)}">${escapeHtml(value)}</a>`
    : `<span>${escapeHtml(value || "Not provided")}</span>`;

  return `<div class="meta-item">
    <dt>${escapeHtml(label)}</dt>
    <dd>${content}</dd>
  </div>`;
}

function badge(label, className = "") {
  if (!label) {
    return "";
  }
  return `<span class="${escapeHtml(["badge", className].filter(Boolean).join(" "))}">${escapeHtml(label)}</span>`;
}

function renderAddonIcon(addon) {
  if (addon.icon) {
    return `<img src="${escapeHtml(addon.icon)}" alt="" class="addon-icon">`;
  }
  return `<div class="addon-icon icon-fallback">${escapeHtml(addon.name.slice(0, 2))}</div>`;
}

function renderAuthor(addon) {
  if (!addon.author) {
    return "<span>Unknown author</span>";
  }
  return `<a href="${escapeHtml(addon.authorUrl || "#")}" class="author">${escapeHtml(addon.author)}</a>`;
}

function renderBadges(addon) {
  return [
    addon.recommended ? badge("Recommended", "recommended") : "",
    addon.compatibility ? badge(addon.compatibility, "compatibility") : "",
  ].join("");
}

function renderScreenshots(addon) {
  if (!addon.screenshots.length) {
    return "";
  }

  const screenshots = addon.screenshots
    .map((screenshot) => {
      const caption = text(screenshot.caption);
      const alt = caption || `${addon.name} screenshot`;
      const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
      return `<figure class="screenshot">
        <img src="${escapeHtml(screenshot.src)}" alt="${escapeHtml(alt)}" loading="lazy">
        ${figcaption}
      </figure>`;
    })
    .join("");

  return `<section class="section screenshots">
    <h2>Screenshots</h2>
    <div class="screenshot-strip">
      ${screenshots}
    </div>
  </section>`;
}

function renderPermissions(addon) {
  const permissions = addon.permissions.length
    ? addon.permissions
    : ["This add-on does not request special permissions."];
  return permissions.map((permission) => `<li>${escapeHtml(permission)}</li>`).join("");
}

function renderMetadata(addon) {
  const hasCategories = addon.categories.length > 0;
  const hasTags = addon.tags.length > 0;

  return [
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
    hasCategories ? metadataItem("Categories", addon.categories.join(", ")) : "",
    hasTags ? metadataItem("Tags", addon.tags.join(" · ")) : "",
  ].join("");
}

function fillTemplate(template, values) {
  return template
    .replace(/{{{\s*([A-Za-z0-9_]+)\s*}}}/g, (_, key) => values[key] ?? "")
    .replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, key) => escapeHtml(values[key] ?? ""));
}

export async function renderListingPage(addon) {
  const template = await fs.readFile(listingTemplatePath, "utf8");
  return fillTemplate(template, {
    title: `${addon.name} - Thunderbird Add-ons`,
    siteCssUrl: addon.siteCssUrl,
    homeUrl: addon.homeUrl,
    siteLogoUrl: addon.siteLogoUrl,
    extensionsUrl: addon.extensionsUrl,
    themesUrl: addon.themesUrl,
    moreUrl: addon.moreUrl,
    addonIconHtml: renderAddonIcon(addon),
    name: addon.name,
    authorHtml: renderAuthor(addon),
    summary: addon.summary,
    badgesHtml: renderBadges(addon),
    downloadUrl: addon.downloadUrl,
    screenshotsSectionHtml: renderScreenshots(addon),
    descriptionHtml: addon.descriptionHtml,
    homepageLinkHtml: link(addon.homepage, "Homepage", "read-more"),
    permissionsHtml: renderPermissions(addon),
    metadataItemsHtml: renderMetadata(addon),
    thunderbirdWordmarkUrl: addon.thunderbirdWordmarkUrl,
    mozillaLogoUrl: addon.mozillaLogoUrl,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
