/** Client-safe runtime configuration derived from public env vars. */
export const config = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AI Medical Vision Platform",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
} as const;
