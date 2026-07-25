# Multi-Tenant ERP Expansion Plan

This is a large, multi-phase build. To keep everything working and avoid breaking existing auth/finance features, I'll deliver it in **4 incremental phases**. Each phase is independently shippable and doesn't touch existing modules unless noted.

---

## Phase 1 — Super Admin Dashboard (separate shell)

**Goal:** Give Super Admins a dedicated experience, distinct from Company Admin.

- New route tree `/super/*` with its own sidebar (Dashboard, Companies, Users, Activity Logs, Settings).
- Existing `/dashboard`, `/transactions`, etc. remain the Company shell — hidden from Super Admins in nav (still reachable via impersonation).
- **Companies page**: paginated table of every company with Name, Type, Owner, Status, Created, Active Users, Total Income, Total Expense. Search / filter / sort.
- **Cross-company overview**: totals (companies, users, income, expense, transactions) + recent activity feed.
- **Impersonation ("Open as Admin")**: sets an `active_company_id` in session; Company shell then scopes to that company. A persistent banner shows "Viewing as {Company} — Exit" so it's obvious and auditable. Every impersonation write is logged in `audit_logs`.
- New DB additions: `company_type` enum column on `companies` (`personal` | `commercial`), impersonation audit rows.

## Phase 2 — Company Types + Dashboard cards & category graphs

- Company creation form gains required **Personal / Commercial** choice.
- Existing Company dashboard is **extended** (not replaced):
  - Extra KPI cards: Incoming, Outgoing, Net Profit, Monthly Revenue, Monthly Expense.
  - Extra charts: Expense by Category, Income by Category, Category Comparison, Top Categories. Existing charts stay.

## Phase 3 — Dynamic Records Engine (the core new module)

A single generic engine — no per-business-type code.

- New tables:
  - `record_entities` (company_id, name, singular, icon) — e.g. "Students", "Inventory".
  - `record_fields` (entity_id, key, label, type, options jsonb, position, required, visible) — types: text/number/currency/date/email/phone/boolean/select/multiselect.
  - `records` (entity_id, company_id, data jsonb) — flexible payload validated against fields.
- **Nav item "Records"** in Company sidebar → list of entities the company defined → each entity opens a fully dynamic table.
- **Column manager** (add / rename / delete / reorder / hide / retype).
- **Dynamic form** for manual entry — regenerates from field config.
- **Filters** per column (contains, equals, range, in, date range) + full-text search.
- **Server-side pagination** using indexed jsonb queries.
- All rows scoped by RLS to `company_id`; Super Admin impersonation respected via helper.

## Phase 4 — Import / Export + Attendance + Payments

- **Excel/CSV import** using `xlsx` on the client: parse headers → map to fields → for unmapped headers prompt "Create this column?" (auto-create with inferred type) → batch insert with progress.
- **Export** current view (filters/sorting/columns) to `.xlsx` and `.csv`; PDF deferred.
- **Attendance module** — generic: `record_attendance` (record_id, date, status, notes) with company-defined status labels (Present/Absent/Late for employees, Present/Absent for students, etc.). Same UI, different labels per entity.
- **Payments module** — generic: `record_payments` (record_id, amount, paid_on, due_on, status, method, notes). Provides Paid / Pending / Outstanding roll-ups per record and per entity.
- Import/export history tables for auditing.

---

## Technical notes

- **Backend:** additive migrations only. New tables get standard `GRANT` + RLS scoped via existing `is_company_member` / `is_super_admin` helpers. Impersonation is enforced by a `SECURITY DEFINER` `current_company_id()` helper that reads either the user's own membership or the active impersonation record for a super admin.
- **Frontend:** new routes under `src/routes/_authenticated/super/*` and `src/routes/_authenticated/records/*`. Existing routes untouched. Sidebar in `_authenticated/route.tsx` conditionally renders Super Admin nav vs Company nav based on active context.
- **No changes to:** auth flow, first-login flow, existing finance tables, existing routes, styling tokens.

---

## Scope check before I start

This is roughly **20–30 files** and **3–4 migrations**. To keep turns manageable and let you verify each piece, I'll start with **Phase 1 (Super Admin shell + Companies page + impersonation)** and pause for you to test before moving on.

Reply **"go"** to start Phase 1, or tell me to reorder / drop phases.