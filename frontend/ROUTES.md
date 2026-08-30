# Frontend Routes

## Existing

- `/` → Landing → `src/pages/Landing.jsx`
- `/login` → Login → `src/pages/Login.jsx`
- `/signup` → Signup → `src/pages/Signup.jsx`
- `/dashboard` → Dashboard (layout shell with sidebar) → `src/pages/Dashboard.jsx`
  - `/dashboard` → Dashboard Home → `src/pages/DashboardHome.jsx`
  - `/dashboard/transactions` → Transactions → `src/pages/TransactionsPage.jsx`
  - `/dashboard/approvals` → Approvals Queue → `src/pages/ApprovalsQueue.jsx`
  - `/dashboard/roi` → ROI & Metrics → `src/pages/ROIMetrics.jsx`
  - `/dashboard/audit` → Audit Trail → `src/pages/AuditTrail.jsx`

## Planned

1. `/dashboard/transactions/:id` → Transaction Detail
   - `GET /api/transactions/:id`
   - `POST /api/transactions/:id/process`

2. `/dashboard/ingest` → Manual Transaction Ingest
   - `POST /api/transactions/ingest`

3. `/dashboard/system` → System Health
   - `GET /api/health`
   - `GET /api/ai/llmTest`

4. `/dashboard/benchmark` → Benchmark & Performance
   - `GET /api/benchmark/run`
   - `GET /api/benchmark/results`

5. `/dashboard/users` → User Management
   - `GET /api/auth/users`
