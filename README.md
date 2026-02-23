# Admin Dashboard

Next.js + shadcn UI dashboard for w-ai. Connects to Convex backend.

## Quick start
```bash
cd admin-dashboard
npm install
cp .env.example .env.local   # edit with your Convex URL
npm run dev
```

## Production deployment

### 1. Build
```bash
cd admin-dashboard
npm install
npm run typecheck
npm run build
```

### 2. Environment
Copy `.env.example` to `.env.local` (local) or set env vars in your host (Vercel, etc.):

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL (`https://<deployment>.convex.cloud`) |
| `CONVEX_DEPLOYMENT` | For dev | e.g. `dev:hardy-gopher-480` |
| `NEXT_PUBLIC_EXTENDED_CAMPAIGN_APIS` | No | `1` for full campaign features |

### 3. Deploy Convex backend
```bash
cd admin-dashboard
npx convex deploy
```

### 4. Run production server
```bash
npm run start
```

Or deploy to Vercel / any Node host; build command: `npm run build`, output: `.next`.

## Convex
- Backend: `convex/`
- Config: `convex.json`

Commands:
```bash
npm run convex:dev     # dev with hot reload
npm run convex:codegen # regenerate types
npm run convex:deploy  # deploy to production
```

If you see access errors, run `npx convex dev` and select a deployment your account can access.

## Structure
- `src/app/` – Next.js pages (dashboard, campaigns, chat, customers, products, templates, etc.)
- `src/components/` – UI components
- `src/mock/` – Convex API layer (namespace routing)
