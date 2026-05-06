import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

type ManifestContentScript = {
  js?: string[]
  matches?: string[]
}

type ExtensionManifest = {
  content_scripts?: ManifestContentScript[]
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm"
}

function readManifest(manifestPath: string): ExtensionManifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ExtensionManifest
}

describe("built extension manifest", () => {
  it(
    "emits at least one match pattern for every generated content script",
    () => {
      const projectRoot = process.cwd()
      const buildRoot = path.resolve(projectRoot, "build")

      fs.rmSync(buildRoot, { recursive: true, force: true })

      execFileSync(getNpmCommand(), ["run", "build"], {
        cwd: projectRoot,
        env: {
          ...process.env,
          CI: "1"
        },
        stdio: "pipe"
      })

      const manifestPaths = [
        path.resolve(buildRoot, "chrome-mv3-dev", "manifest.json"),
        path.resolve(buildRoot, "chrome-mv3-prod", "manifest.json")
      ].filter((manifestPath) => fs.existsSync(manifestPath))

      expect(manifestPaths.length).toBeGreaterThan(0)

      for (const manifestPath of manifestPaths) {
        const manifest = readManifest(manifestPath)

        expect(manifest.content_scripts?.length ?? 0).toBeGreaterThan(0)

        for (const entry of manifest.content_scripts ?? []) {
          expect(entry.matches?.length ?? 0, `${manifestPath}: ${JSON.stringify(entry)}`).toBeGreaterThan(0)
        }
      }
    },
    120000
  )
})
