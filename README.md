# OfficeHub — Office / HR Management

A full-stack office management dashboard: employees, attendance, leaves, payroll,
documents, tasks, and departments. Inspired by the Pagedone HR Management Figma
template — purple/indigo theme, sidebar nav, card-based dashboard.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM ·
**MySQL** (via `mysql2`, pure-JS driver — no native compilation needed) ·
JWT cookie auth (jose) · Recharts · Lucide icons

## Setup

### 1. Get MySQL running
You need a MySQL (or MariaDB) server. Easiest local options on Windows:
- **XAMPP** (mysqld comes with it, likely already on your machine if you've used it before)
- **MySQL Installer** from mysql.com
- Or Docker: `docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root mysql:8`

Create the database:
```sql
CREATE DATABASE officehub;
```

### 2. Configure the connection
Copy `.env.example` to `.env` and set your connection string:
```
DATABASE_URL=mysql://root:yourpassword@localhost:3306/officehub
AUTH_SECRET=some-long-random-string
```

### 3. Install & seed
```bash
npm install
npm run seed      # creates tables in officehub and fills them with sample data
npm run dev        # http://localhost:3000
```

Login with:
- **Admin:** admin@officehub.io / admin123
- **HR:** farzana.yasmin@officehub.io / password123

Re-run `npm run seed` anytime to reset the database back to sample data
(it wipes and reseeds all tables).

## What's included

| Module | What it does |
|---|---|
| Dashboard | Live stats, 7-day attendance chart, department breakdown, recent leaves/tasks |
| Employees | Full CRUD, search, department assignment, status |
| Attendance | Daily check-in/out per employee, date picker, present/late/absent counts |
| Leaves | Request leave, approve/reject (auto-flips employee status to "on leave") |
| Payroll | Generate monthly entries from base salary, bonus/deduction, mark as paid |
| Documents | Track employee/company files by category |
| Tasks | Kanban board (To do / In progress / Done), assignee, priority, due date |
| Departments | Manage departments with live headcount |
| Calendar | Month view showing approved leaves per day |

## Structure

```
app/
  (app)/            # authenticated pages, share the sidebar layout
  api/               # REST-ish API routes per entity
  login/             # public login page
lib/
  schema.ts          # Drizzle table definitions (MySQL dialect)
  db.ts              # MySQL connection pool
  auth.ts             # JWT session helpers
scripts/seed.ts       # creates tables + sample data generator
drizzle.config.ts      # drizzle-kit config, for future migrations
middleware.ts          # route protection (redirects unauthenticated users)
```

## Production

```bash
npm run build
npm run start
```

Set a real `AUTH_SECRET` and a production `DATABASE_URL` in `.env` before
deploying anywhere public.

## Why MySQL + Drizzle (not Prisma)

This started on Prisma, but Prisma's query-engine binary needs a network
download at `npx prisma generate` time — which failed to download in the
sandbox this was built in. Drizzle has no such binary; it's pure TypeScript
talking directly to `mysql2`. Functionally equivalent for this app — schema,
type-safe queries, migrations via `drizzle-kit`. If you'd rather standardize
on Prisma (like your XRI website project), it's a straightforward swap since
the table shapes carry over directly — just ask.

## Extending

- Real file uploads for Documents: currently it tracks file *metadata* only
  (name/category/date); wire up S3 or local disk storage behind the existing
  `/api/documents` POST route.
- Payroll is manual-entry; could auto-generate one entry per active employee
  per month via a scheduled script that reuses the `POST /api/payroll` logic.
- `drizzle-kit push` (see `drizzle.config.ts`) can manage schema migrations
  going forward instead of the raw `CREATE TABLE IF NOT EXISTS` in seed.ts.
