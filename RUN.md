# RUN.md — How to run this project

Needs: **Node 20**, **pnpm 9**, **Python 3.12+**. No Docker/Postgres/Redis required (dev uses SQLite + in-memory cache).

> Project root: `C:\Ai Agents\cancer and eye agent`

---

## 1. One-time setup

```powershell
cd "C:\Ai Agents\cancer and eye agent"
copy .env.example .env
# now open .env and set:  OPENAI_API_KEY=sk-...

pnpm install

cd "C:\Ai Agents\cancer and eye agent\apps\api"
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

---

## 2. Run it — two terminals

**Terminal 1 — backend:**
```powershell
cd "C:\Ai Agents\cancer and eye agent\apps\api"
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```powershell
cd "C:\Ai Agents\cancer and eye agent"
pnpm dev
```

Open:
- App → http://localhost:3000
- API docs → http://localhost:8000/docs

No login needed (dev auto-login is on). AI models download automatically on first run (~120 MB).

---

## 3. Handy commands

**Frontend** (run from `C:\Ai Agents\cancer and eye agent`):
```powershell
cd "C:\Ai Agents\cancer and eye agent"
pnpm dev      # start frontend
pnpm build    # build frontend
pnpm lint     # lint
```

**Backend** (run from `C:\Ai Agents\cancer and eye agent\apps\api`, venv activated):
```powershell
cd "C:\Ai Agents\cancer and eye agent\apps\api"
.venv\Scripts\activate
uvicorn app.main:app --reload   # start backend
pytest -q                       # tests
ruff check app                  # lint
```

---

## 4. If the frontend won't start (`EADDRINUSE :::3000`)

A previous server is still running. Kill it, then run `pnpm dev` again:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

If `pnpm build` fails with `EPERM ... .next` — stop node and delete the build folder:

```powershell
Get-Process node | Stop-Process -Force
Remove-Item -Recurse -Force "C:\Ai Agents\cancer and eye agent\apps\web\.next"
```

macOS/Linux equivalent for the port fix: `lsof -ti:3000 | xargs kill -9`
