import { beforeEach, describe, expect, it, vi } from "vitest"

const createClient = vi.fn(() => ({}))
vi.mock("@supabase/supabase-js", () => ({ createClient }))

async function loadClient() {
  vi.resetModules()
  const { getSupabaseClient } = await import("./supabase")
  getSupabaseClient()
  return createClient.mock.calls[0] as unknown as [string, string, { global?: { headers?: Record<string, string> } }]
}

describe("getSupabaseClient", () => {
  beforeEach(() => {
    createClient.mockClear()
    vi.unstubAllEnvs()
  })

  it("sends the private token the tweets table's access rules check for", async () => {
    vi.stubEnv("PLASMO_PUBLIC_TWEETS_TOKEN", "test-token")
    const [, , options] = await loadClient()
    expect(options.global?.headers?.["x-tweets-token"]).toBe("test-token")
  })

  it("sends no token header in a build made without one", async () => {
    vi.stubEnv("PLASMO_PUBLIC_TWEETS_TOKEN", "")
    const [, , options] = await loadClient()
    expect(options.global?.headers?.["x-tweets-token"]).toBeUndefined()
  })
})
