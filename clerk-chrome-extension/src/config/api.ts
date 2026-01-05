/**
 * API configuration constants.
 */

/**
 * Base URL for the backend API.
 * Uses PLASMO_PUBLIC_API_BASE_URL environment variable if available,
 * otherwise defaults to localhost:3000 for development.
 */
export const API_BASE_URL = process.env.PLASMO_PUBLIC_API_BASE_URL || "http://localhost:3000"
