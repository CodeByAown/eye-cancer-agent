# Deploy to Render

This repo has a `render.yaml` blueprint that creates 3 things: the **backend**
(FastAPI), the **frontend** (Next.js), and a **Postgres** database.

## Steps

1. Go to **https://dashboard.render.com** → **New +** → **Blueprint**.
2. Connect your GitHub and pick the repo **`CodeByAown/eye-cancer-agent`**.
3. Render reads `render.yaml` and shows: `amvp-api`, `amvp-web`, `amvp-db`.
   Click **Apply**. It will ask for the `sync:false` values:
   - **amvp-api → `OPENAI_API_KEY`** = your `sk-...` key.
   - Leave `API_CORS_ORIGINS` and `NEXT_PUBLIC_API_URL` blank for now (step 5).
4. Wait for the first deploy. Note the two URLs Render assigns, e.g.:
   - backend  → `https://amvp-api.onrender.com`
   - frontend → `https://amvp-web.onrender.com`
5. Set the two cross-URLs, then redeploy:
   - **amvp-api** → Environment → `API_CORS_ORIGINS` = `https://amvp-web.onrender.com` → Save.
   - **amvp-web** → Environment → `NEXT_PUBLIC_API_URL` = `https://amvp-api.onrender.com` → Save.
   - Redeploy **amvp-web** (its URL is baked in at build time), then **amvp-api**.
6. Open the frontend URL. Done.

## Verify
- `https://amvp-api.onrender.com/api/v1/health` → `{"status":"ok",...}`
- `https://amvp-api.onrender.com/docs` → API docs
- `https://amvp-web.onrender.com` → the app

## Notes
- **First request is slow.** Free services sleep when idle and re-download the AI
  models (~120 MB) on cold start. Upgrade the plan to keep them warm.
- **Memory:** the fundus model is heavy. If `amvp-api` crashes with OOM on the
  free 512 MB plan, upgrade it to **Starter**.
- **Auth** is dev-bypass (auto-login) since Clerk isn't configured — fine for a demo.
- **Data** persists in the Render Postgres DB. Uploaded images use the container's
  local disk (ephemeral) — set `STORAGE_BACKEND=s3` + S3 vars for durable storage.
