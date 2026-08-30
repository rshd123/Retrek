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
  - `/dashboard/benchmark` → Benchmark & Evaluation → `src/pages/BenchmarkPage.jsx`
  - `/dashboard/system` → System Health & Diagnostics → `src/pages/SystemHealth.jsx`

## Planned

1. `/dashboard/transactions/:id` → Transaction Detail
   - `GET /api/transactions/:id`
   - `POST /api/transactions/:id/process`

2. `/dashboard/ingest` → Manual Transaction Ingest
   - `POST /api/transactions/ingest`

3. `/dashboard/users` → User Management
   - `GET /api/auth/users`
