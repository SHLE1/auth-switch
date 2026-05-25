#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const asar = require("@electron/asar");

const releaseDir = path.resolve(process.argv[2] ?? "release");

function walk(dir, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matches);
    } else if (entry.isFile() && entry.name === "app.asar") {
      matches.push(fullPath);
    }
  }
  return matches;
}

function hasAnyExternalUpdaterReference(source) {
  return [
    /import\(["']electron-updater["']\)/,
    /require\(["']electron-updater["']\)/,
    /from ["']electron-updater["']/
  ].some((pattern) => pattern.test(source));
}

function normalizeAsarPath(file) {
  return file.replace(/\\/g, "/");
}

function hasPackagedNodeModule(normalizedFilePaths, packageName) {
  return normalizedFilePaths.some((file) => file.startsWith(`/node_modules/${packageName}/`));
}

function verifyAsar(appAsar) {
  const files = asar.listPackage(appAsar);
  const normalizedFiles = new Map(files.map((file) => [normalizeAsarPath(file), file]));
  const normalizedFilePaths = [...normalizedFiles.keys()];
  const mainBundlePath = "/out/main/index.js";
  const resourcesDir = path.dirname(appAsar);
  const externalTrayIcon = path.join(resourcesDir, "assets", "tray-icon.png");
  const unpackedDir = path.join(resourcesDir, "app.asar.unpacked");

  if (!normalizedFiles.has(mainBundlePath)) {
    throw new Error(`${appAsar}: missing ${mainBundlePath}`);
  }

  if (!fs.existsSync(externalTrayIcon) && !normalizedFiles.has("/assets/tray-icon.png")) {
    throw new Error(`${appAsar}: missing packaged tray icon`);
  }

  const requiredSqlitePackages = ["better-sqlite3", "bindings", "file-uri-to-path"];
  const missingSqlitePackages = requiredSqlitePackages.filter(
    (packageName) => !hasPackagedNodeModule(normalizedFilePaths, packageName)
  );

  if (missingSqlitePackages.length > 0) {
    throw new Error(
      `${appAsar}: better-sqlite3 runtime dependencies are incomplete: ${missingSqlitePackages.join(", ")}`
    );
  }

  const nativeSqliteBinding = path.join(
    unpackedDir,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );
  if (!fs.existsSync(nativeSqliteBinding)) {
    throw new Error(`${appAsar}: missing unpacked better-sqlite3 native binding`);
  }

  const mainSources = [...normalizedFiles.entries()]
    .filter(([normalized]) => normalized.startsWith("/out/main/") && normalized.endsWith(".js"))
    .map(([, original]) => asar.extractFile(appAsar, original.replace(/^[/\\]/, "")).toString("utf8"));
  const updaterIsRuntimeExternal = mainSources.some(hasAnyExternalUpdaterReference);

  if (!updaterIsRuntimeExternal) {
    console.log(`OK ${appAsar}: electron-updater is bundled into the main process`);
    return;
  }

  const requiredExternalPackages = [
    "electron-updater",
    "builder-util-runtime",
    "debug",
    "ms",
    "sax",
    "fs-extra",
    "graceful-fs",
    "jsonfile",
    "universalify",
    "js-yaml",
    "argparse",
    "lazy-val",
    "semver",
    "tiny-typed-emitter",
    "lodash.escaperegexp",
    "lodash.isequal"
  ];

  const missing = requiredExternalPackages.filter(
    (packageName) => !hasPackagedNodeModule(normalizedFilePaths, packageName)
  );

  if (missing.length > 0) {
    throw new Error(
      `${appAsar}: electron-updater is runtime-external but packaged dependencies are incomplete: ${missing.join(", ")}`
    );
  }

  console.log(`OK ${appAsar}: electron-updater external dependency closure is packaged`);
}

const appAsars = walk(releaseDir);
if (appAsars.length === 0) {
  throw new Error(`No app.asar files found under ${releaseDir}`);
}

for (const appAsar of appAsars) {
  verifyAsar(appAsar);
}
