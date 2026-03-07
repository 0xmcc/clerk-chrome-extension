const fs = require("fs")
const path = require("path")

const buildDir = path.join(__dirname, "..", "build", "chrome-mv3-prod")
const manifestPath = path.join(buildDir, "manifest.json")

const FORBIDDEN_HOST_PERMISSIONS = new Set([
  "https://x.com/*",
  "https://twitter.com/*",
  "https://api.agentmail.to/*"
])

const TWEET_SCRIPT_FILE_PATTERN = /^twitter-save-button\..+\.js$/

function fail(message) {
  throw new Error(`[prepare-prod-manifest] ${message}`)
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    fail(`manifest not found at ${manifestPath}`)
  }

  const raw = fs.readFileSync(manifestPath, "utf8")
  return JSON.parse(raw)
}

function hasTweetSaverScriptEntry(entry) {
  if (!entry || !Array.isArray(entry.js)) return false
  return entry.js.some((asset) => asset.includes("twitter-save-button"))
}

function sanitizeManifest(manifest) {
  delete manifest.key

  if (Array.isArray(manifest.content_scripts)) {
    manifest.content_scripts = manifest.content_scripts.filter(
      (entry) => !hasTweetSaverScriptEntry(entry)
    )
  }

  if (Array.isArray(manifest.host_permissions)) {
    manifest.host_permissions = manifest.host_permissions.filter(
      (permission) => !FORBIDDEN_HOST_PERMISSIONS.has(permission)
    )
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}

function removeTweetSaverBuildAssets() {
  const files = fs.readdirSync(buildDir)
  for (const file of files) {
    if (TWEET_SCRIPT_FILE_PATTERN.test(file)) {
      fs.unlinkSync(path.join(buildDir, file))
    }
  }
}

function verifySanitizedOutput() {
  const manifest = readManifest()

  if (manifest.key) {
    fail("manifest key is still present")
  }

  if (Array.isArray(manifest.content_scripts)) {
    const leaked = manifest.content_scripts.find(hasTweetSaverScriptEntry)
    if (leaked) {
      fail("twitter-save-button content script still present in manifest")
    }
  }

  if (Array.isArray(manifest.host_permissions)) {
    const leakedPermission = manifest.host_permissions.find((permission) =>
      FORBIDDEN_HOST_PERMISSIONS.has(permission)
    )
    if (leakedPermission) {
      fail(`forbidden host permission still present: ${leakedPermission}`)
    }
  }

  const files = fs.readdirSync(buildDir)
  const leakedScript = files.find((file) => TWEET_SCRIPT_FILE_PATTERN.test(file))
  if (leakedScript) {
    fail(`twitter-save-button build asset still present: ${leakedScript}`)
  }
}

sanitizeManifest(readManifest())
removeTweetSaverBuildAssets()
verifySanitizedOutput()

console.log("[prepare-prod-manifest] Production manifest sanitized and verified.")
