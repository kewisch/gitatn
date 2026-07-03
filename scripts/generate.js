import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import yaml from "js-yaml";
import { renderListingPage } from "../src/renderListingPage.js";

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const addonRoot = path.join(rootDir, "addon-data");
const buildDir = path.join(rootDir, "build");
const locale = "en-US";

const permissionLabels = new Map([
  ["accountsRead", "Read your mail accounts and folders"],
  ["compose", "Read and modify message compose windows"],
  ["messagesMove", "Move email messages"],
  ["messagesRead", "Read email messages"],
  ["messagesTags", "Apply and remove message tags"],
  ["messagesTagsList", "Read your message tags"],
  ["messagesUpdate", "Update email message properties"],
  ["notifications", "Display notifications"],
  ["storage", "Store data on your device"],
]);

async function main() {
  const requestedSlugs = process.argv.slice(2);
  const slugs = requestedSlugs.length ? requestedSlugs : await findAddonSlugs();
  const isTargetedGeneration = requestedSlugs.length > 0;

  if (!isTargetedGeneration) {
    await fs.rm(buildDir, { recursive: true, force: true });
  }
  await fs.mkdir(path.join(buildDir, "assets"), { recursive: true });
  await fs.copyFile(
    path.join(rootDir, "src", "styles.css"),
    path.join(buildDir, "assets", "site.css")
  );
  await fs.copyFile(
    path.join(rootDir, "src", "logo.svg"),
    path.join(buildDir, "assets", "logo.svg")
  );

  for (const slug of slugs) {
    await generateAddon(slug);
  }

  console.log(`Generated ${slugs.length} add-on listing page(s).`);
}

async function findAddonSlugs() {
  const entries = await fs.readdir(addonRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function generateAddon(slug) {
  const addonDir = path.join(addonRoot, slug);
  const srcDir = path.join(addonDir, "src");
  const listingPath = path.join(addonDir, "listing.yml");
  const manifestPath = path.join(srcDir, "manifest.json");
  const pageDir = `${locale}/thunderbird/addon/${slug}`;
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const listing = await readYaml(listingPath);
  const messages = await readMessages(srcDir, manifest.default_locale || "en");
  const assetDir = path.join(buildDir, "assets", slug);
  await fs.rm(assetDir, { recursive: true, force: true });
  await fs.mkdir(assetDir, { recursive: true });

  const downloadUrl = relativeUrl(pageDir, `thunderbird/downloads/${slug}/latest.xpi`);
  const xpiPath = path.join(buildDir, "thunderbird", "downloads", slug, "latest.xpi");
  await fs.rm(path.dirname(xpiPath), { recursive: true, force: true });
  await fs.mkdir(path.dirname(xpiPath), { recursive: true });
  await createXpi(srcDir, xpiPath);

  const iconRef = firstPresent(listing.icon, largestManifestIcon(manifest));
  const icon = iconRef
    ? await copyAsset(slug, iconRef, addonDir, srcDir, assetDir, pageDir, "icon")
    : "";

  const screenshots = [];
  for (const [index, screenshot] of normalizeScreenshots(listing.screenshots).entries()) {
    const copied = await copyAsset(
      slug,
      screenshot.path,
      addonDir,
      srcDir,
      assetDir,
      pageDir,
      `screenshot-${index + 1}`
    );
    if (copied) {
      screenshots.push({ src: copied, caption: screenshot.caption || "" });
    }
  }

  const normalized = {
    slug,
    name: firstPresent(listing.name, resolveLocaleString(manifest.name, messages), slug),
    summary: firstPresent(
      listing.summary,
      resolveLocaleString(manifest.description, messages),
      "No summary provided."
    ),
    descriptionHtml: renderDescription(
      firstPresent(
        listing.description,
        resolveLocaleString(manifest.description, messages),
        "No description provided."
      )
    ),
    author: firstPresent(listing.author, manifest.author, ""),
    authorUrl: firstPresent(listing.author_url, listing.authorUrl, ""),
    homepage: firstPresent(listing.homepage, ""),
    supportUrl: firstPresent(listing.support_url, listing.supportUrl, ""),
    license: firstPresent(listing.license, ""),
    privacyPolicy: firstPresent(listing.privacy_policy, listing.privacyPolicy, ""),
    recommended: Boolean(firstPresent(listing.recommended, false)),
    categories: normalizeStringList(listing.categories),
    tags: normalizeStringList(listing.tags),
    screenshots,
    icon,
    version: firstPresent(listing.version, manifest.version, "0.0.0"),
    lastUpdated: firstPresent(listing.last_updated, listing.lastUpdated, ""),
    size: await fileSize(xpiPath),
    permissions: normalizePermissions(firstPresent(listing.permissions, manifest.permissions, [])),
    extensionId: manifest.browser_specific_settings?.gecko?.id || "",
    compatibility: compatibilityText(manifest),
    downloadUrl,
    siteCssUrl: relativeUrl(pageDir, "assets/site.css"),
    siteLogoUrl: relativeUrl(pageDir, "assets/logo.svg"),
    homeUrl: relativeUrl(pageDir, `${locale}/thunderbird/`),
    extensionsUrl: relativeUrl(pageDir, `${locale}/thunderbird/extensions/`),
    themesUrl: relativeUrl(pageDir, `${locale}/thunderbird/themes/`),
    moreUrl: relativeUrl(pageDir, `${locale}/thunderbird/more/`),
  };

  const html = await renderListingPage(normalized);
  const outputDir = path.join(buildDir, pageDir);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "index.html"), html);
}

async function readYaml(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return yaml.load(content) || {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function readMessages(srcDir, defaultLocale) {
  const localeDir = defaultLocale.replace("-", "_");
  const messagesPath = path.join(srcDir, "_locales", localeDir, "messages.json");
  try {
    return JSON.parse(await fs.readFile(messagesPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function resolveLocaleString(value, messages) {
  if (typeof value !== "string") {
    return value;
  }
  const match = value.match(/^__MSG_([A-Za-z0-9_.@-]+)__$/);
  if (!match) {
    return value;
  }
  return messages[match[1]]?.message || value;
}

function largestManifestIcon(manifest) {
  const entries = Object.entries(manifest.icons || {});
  if (!entries.length) {
    return "";
  }
  entries.sort((a, b) => Number(b[0]) - Number(a[0]));
  return entries[0][1];
}

async function copyAsset(slug, ref, addonDir, srcDir, assetDir, pageDir, prefix) {
  if (!ref || /^https?:\/\//.test(ref)) {
    return ref || "";
  }
  const source = await resolveLocalAsset(ref, addonDir, srcDir);
  if (!source) {
    console.warn(`Skipping missing asset for ${slug}: ${ref}`);
    return "";
  }
  const ext = path.extname(source) || ".dat";
  const fileName = `${prefix}${ext}`;
  await fs.copyFile(source, path.join(assetDir, fileName));
  return relativeUrl(pageDir, `assets/${slug}/${fileName}`);
}

async function resolveLocalAsset(ref, addonDir, srcDir) {
  const candidates = [];
  if (path.isAbsolute(ref)) {
    candidates.push(ref);
  } else {
    candidates.push(path.join(addonDir, ref));
    candidates.push(path.join(srcDir, ref));
  }

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return "";
}

function normalizeScreenshots(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { path: item, caption: "" };
      }
      return {
        path: item?.path || item?.src || "",
        caption: item?.caption || item?.alt || "",
      };
    })
    .filter((item) => item.path);
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(Boolean).map(String);
}

function normalizePermissions(value) {
  return normalizeStringList(value).map((permission) => {
    return permissionLabels.get(permission) || permission;
  });
}

function compatibilityText(manifest) {
  const gecko = manifest.browser_specific_settings?.gecko;
  if (!gecko?.strict_min_version) {
    return "";
  }
  const max = gecko.strict_max_version ? ` to ${gecko.strict_max_version}` : " and later";
  return `Works with Thunderbird ${gecko.strict_min_version}${max}`;
}

function renderDescription(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "<p>No description provided.</p>";
  }
  if (/<[a-z][\s\S]*>/i.test(source)) {
    return source;
  }
  return source
    .split(/\n{2,}/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) {
        return "";
      }
      if (/^[-*]\s+/m.test(trimmed)) {
        const items = trimmed
          .split(/\n/)
          .map((line) => line.replace(/^[-*]\s+/, "").trim())
          .filter(Boolean)
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${escapeHtml(trimmed).replaceAll("\n", "<br>")}</p>`;
    })
    .join("\n");
}

async function createXpi(srcDir, outputPath) {
  await execFileAsync(
    "zip",
    [
      "-qr",
      outputPath,
      ".",
      "-x",
      "*.swp",
      "*.swo",
      ".DS_Store",
      "*/.DS_Store",
      "__MACOSX/*",
    ],
    { cwd: srcDir }
  );
}

async function fileSize(filePath) {
  const stat = await fs.stat(filePath);
  const size = stat.size;
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function firstPresent(...values) {
  return values.find((value) => {
    if (value == null) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return value !== "";
  });
}

function relativeUrl(fromDir, toPath) {
  return path.posix.relative(fromDir, toPath) || ".";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
