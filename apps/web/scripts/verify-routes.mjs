/**
 * Automated route verification.
 *
 * Cross-checks every internal href referenced in the source against the actual
 * Next.js App Router pages. Fails (exit 1) if any link points to a route that
 * does not exist. Run in CI and locally: `node scripts/verify-routes.mjs`.
 *
 * Dynamic segments ([id]) are matched structurally. External links, anchors,
 * and the "#" placeholder (intentionally non-navigable "soon" items) are skipped.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src");
const appDir = join(root, "app");

/** Walk a dir for files matching a predicate. */
function walk(dir, pred, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, pred, acc);
    else if (pred(full)) acc.push(full);
  }
  return acc;
}

/** Derive the URL path for a page.tsx, stripping route groups like (app). */
function routeForPage(file) {
  let rel = relative(appDir, file)
    .replace(/\\/g, "/")
    .replace(/\/?page\.tsx$/, "");
  rel = rel
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");
  return "/" + rel;
}

const pageFiles = walk(appDir, (f) => f.endsWith("page.tsx"));
const routes = new Set(pageFiles.map(routeForPage));
routes.add("/"); // root

/** Convert a concrete href to a route pattern match (handles [dynamic]). */
function routeExists(href) {
  const clean = href.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  if (routes.has(clean)) return true;
  // Structural match against dynamic segments.
  const parts = clean.split("/");
  for (const route of routes) {
    const rparts = route.split("/");
    if (rparts.length !== parts.length) continue;
    const ok = rparts.every((seg, i) => seg.startsWith("[") || seg === parts[i]);
    if (ok) return true;
  }
  return false;
}

// Collect all internal hrefs from source.
const srcFiles = walk(root, (f) => f.endsWith(".tsx") || f.endsWith(".ts"));
const hrefRe = /href[=:]\s*["'`](\/[^"'`]*)["'`]/g;
const found = new Map(); // href -> [files]

for (const file of srcFiles) {
  const text = readFileSync(file, "utf8");
  let m;
  while ((m = hrefRe.exec(text))) {
    const href = m[1];
    if (!found.has(href)) found.set(href, []);
    found.get(href).push(relative(root, file));
  }
}

const broken = [];
for (const [href, files] of found) {
  if (href === "#" || href.startsWith("//")) continue;
  if (!routeExists(href)) broken.push({ href, files });
}

console.log(`Routes found (${routes.size}):`);
[...routes].sort().forEach((r) => console.log("  ✓ " + r));
console.log(`\nInternal links referenced: ${found.size}`);

if (broken.length) {
  console.error(`\n✗ ${broken.length} BROKEN link(s):`);
  for (const b of broken) console.error(`  ✗ ${b.href}  (in ${b.files.join(", ")})`);
  process.exit(1);
}
console.log("\n✓ All internal links resolve to real routes.");
