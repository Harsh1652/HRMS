# HR Management System

## 1. Overview

A full-stack HR register (MVP): a React frontend and an Express + TypeScript API over PostgreSQL (Supabase) via Prisma, with JWT authentication and **role- and object-level authorization enforced on the backend**.

Three roles use it: **HR / Admin** manages every employee, **Managers** see and edit their direct reports, and **Employees** see and edit only themselves. All authorization rules are in one file, [`backend/src/policies/employeePolicy.ts`](backend/src/policies/employeePolicy.ts). No other backend code branches on a user's role.

| Part | Runs at |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:4000/api` |
| Swagger UI | `http://localhost:4000/api/docs` |

## 2. Features

- **Login and logout** with email and password. The API issues short-lived JWT access tokens.
- **Employee directory** with search, department and status filters, and pagination. Each role sees only the employees it may see.
- **Employee detail and profile.** `/me` shows the caller's own record.
- **Create employee** (Admin). Creates the employee record and their login in one transaction, with an auto-generated ID (`EMP100`, `EMP101`, …).
- **Edit employee** with field-level rules. Employees may edit their own phone number; managers may edit a direct report's designation and department; Admin may edit any field.
- **Soft delete** (Admin). Marks the employee `INACTIVE` and disables their login immediately.
- **Dashboard** with total, active and inactive counts and a per-department breakdown, limited to the caller's scope.
- **API docs** in Swagger UI and an OpenAPI 3.0 spec.
- **Responsive UI** that works at phone width.

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 3, TanStack Query 5, React Router 7, React Hook Form + Zod, Axios |
| Backend | Node.js 20+, Express 4, TypeScript (CommonJS), Zod, pino / pino-http, helmet, cors |
| Database | PostgreSQL (Supabase) via Prisma 6 |
| Auth | JSON Web Tokens (`jsonwebtoken`), bcrypt (cost 12) |
| API docs | OpenAPI 3.0 (hand-written `openapi.yaml`) + `swagger-ui-express` |
| Testing | Jest + ts-jest, Supertest |
| Tooling | ESLint (backend), oxlint (frontend) |

## 4. Architecture

```
┌──────────────────────┐   HTTPS / JSON + Bearer JWT   ┌──────────────────────────────────────────┐
│  React SPA (Vite)    │ ────────────────────────────▶ │  Express API                             │
│  AuthContext         │                               │  helmet · cors · requestLogger           │
│  ProtectedRoute      │ ◀──────────────────────────── │  authenticate  (JWT + isActive re-check) │
│  RoleGate (cosmetic) │     { data } | { error }      │  validate      (Zod, .strict())          │
└──────────────────────┘                               │  routes → controller → service           │
                                                       │               │                          │
                                                       │     employeePolicy.ts (all authz rules)  │
                                                       │               │                          │
                                                       │  Prisma Client ─────────▶ PostgreSQL     │
                                                       │  errorHandler (uniform error body)       │
                                                       └──────────────────────────────────────────┘
```

- **Layers.** Each backend module follows routes → controller → service. Controllers deal with HTTP; services hold business logic and call Prisma.
- **Authorization.** Services call the pure functions in `employeePolicy.ts` before touching the database. For lists and dashboard counts, the policy's `where` fragment is added to the SQL query, so rows outside the caller's scope are never loaded.
- **Errors.** Errors are `AppError` subclasses. A single error handler turns them into `{ "error": { "code", "message", "details"? } }`.
- **Frontend.** Route guards and hidden buttons in the frontend only affect what users see. The API makes every access decision.

## 5. Folder Structure

```
hrms-main/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          Data model
│   │   ├── migrations/            SQL migrations (incl. employee_id_seq)
│   │   └── seed.ts                16 employees, 5 known logins
│   ├── src/
│   │   ├── app.ts                 Express app (no listener) — tests import this
│   │   ├── server.ts              listen() + graceful shutdown
│   │   ├── routes.ts              Mounts all modules under /api
│   │   ├── config/env.ts          Zod-validated environment
│   │   ├── middleware/            authenticate · validate · errorHandler · requestLogger
│   │   ├── policies/
│   │   │   └── employeePolicy.ts  ALL authorization rules
│   │   ├── modules/
│   │   │   ├── auth/              login, logout
│   │   │   ├── employees/         routes → controller → service; schemas; DTO
│   │   │   └── dashboard/         scoped stats
│   │   └── utils/                 AppError, asyncHandler, jwt, password, prisma, logger
│   ├── tests/
│   │   ├── unit/                  Policy + error handler (no DB)
│   │   ├── integration/           Supertest against the `test` schema
│   │   ├── helpers/  setup/
│   └── openapi.yaml               API specification
└── frontend/
    └── src/
        ├── api/                   Axios client + interceptors, typed endpoints
        ├── auth/                  Token store, AuthContext, ProtectedRoute, RoleGate
        ├── components/            Button, FormField, Table, Modal, Badge, …
        ├── pages/                 Login, Dashboard, EmployeeList, EmployeeDetail, EmployeeForm, MyProfile
        ├── lib/permissions.ts     Frontend copy of the policy; affects display only, the API enforces
        └── types/
```

## 6. Authentication & Authorization

### Authentication

- `POST /api/auth/login` checks the password with bcrypt (cost 12) and returns a signed JWT (default lifetime `30m`). An unknown email and a wrong password return the **same** 401. For unknown emails the server still compares against a dummy hash, so response time does not reveal whether an email is registered.
- Every protected request sends `Authorization: Bearer <token>`. The [`authenticate`](backend/src/middleware/authenticate.ts) middleware verifies the token, then **reads the `User` row again** to check `isActive` and load the current `role` and `employeeId`. When a user is deactivated, their existing token stops working on its next request.
- The caller's identity comes **only** from the verified token. An employee ID, role or user ID sent in a request body or query string is never used to decide who is calling.
- Logout happens on the client (the frontend discards its token). There are no refresh tokens.

### Authorization (roles)

| Role | Sees | Creates | Deletes | Updates |
|---|---|---|---|---|
| `ADMIN` | every employee | yes | yes (soft) | any field on anyone |
| `MANAGER` | self + direct reports | no | no | self: `phone` · direct report: `designation`, `department` |
| `EMPLOYEE` | self only | no | no | self: `phone` |

"Direct report" means one level only: `target.managerId === actor.employeeId`.

Policy functions ([`employeePolicy.ts`](backend/src/policies/employeePolicy.ts)): `canView`, `canCreate`, `canDelete`, `discloseMissing`, `updatableFields`, `scopeWhere`.

- **Object level.** Single-record lookups use `findFirst({ where: { id, AND: scopeWhere(actor) } })`. Lists and dashboard counts use the same `scopeWhere`, applied in SQL.
- **Field level (mass assignment).** `PUT` bodies are validated with a `.strict()` Zod schema, so unknown keys return 400. Every remaining key is then checked against `updatableFields`. If any key is not allowed, the request returns **403 naming that field** and no change is applied. `req.body` is never passed to Prisma.
- **403 vs 404.** An `ADMIN` who requests an ID that does not exist gets **404**. Any other role that requests an ID outside its scope gets **403**, whether or not the ID exists. Both 403 responses have the same body, so callers cannot tell which IDs exist.

| Situation | Status |
|---|---|
| No token, or a malformed, expired or tampered token, or a deactivated user | 401 |
| Action or record outside the caller's rights | 403 |
| Admin requests a missing ID | 404 |
| Invalid body, query or ID format | 400 |
| Duplicate email | 409 |

## 7. Database Design

Schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

```
┌──────────────────────────┐ 1      1 ┌──────────────────────────────┐
│ User                     │──────────│ Employee                     │
├──────────────────────────┤          ├──────────────────────────────┤
│ id           cuid  PK    │          │ id           "EMP###"  PK    │
│ email        unique      │          │ firstName, lastName          │
│ passwordHash             │          │ email        unique          │
│ role         Role        │          │ phone?                       │
│ isActive     bool        │          │ department   (indexed)       │
│ employeeId   unique FK ──┼─────────▶│ designation                  │
│ createdAt, updatedAt     │          │ joiningDate  date            │
└──────────────────────────┘          │ status       (indexed)       │
                                      │ managerId?   FK → Employee ──┼──┐ self-relation
                                      │ createdAt, updatedAt         │◀─┘ (manager / reports)
                                      └──────────────────────────────┘
enum Role             ADMIN | MANAGER | EMPLOYEE
enum EmploymentStatus ACTIVE | INACTIVE
```

- **`User` ↔ `Employee` is 1:1.** Every employee has exactly one login (`User.employeeId` is unique).
- **`Role` is not a column on `Employee`.** The brief lists `Role` on both Users and Employees. Here it is stored once, on `User.role`, because it controls login and access: the JWT and the authorization policy both read it, and a second copy could fall out of sync. Every employee response still includes `role` (read through the `User` join), `PUT /api/employees/{id}` with `role` updates `User.role` (Admin only), and `POST /api/employees` sets it when creating the login.
- **`Employee.managerId`** points to another employee (`onDelete: SetNull`). The API rejects a manager ID that points to the employee themself or would create a reporting loop.
- **Public IDs** (`EMP100`, `EMP101`, …) come from the Postgres sequence `employee_id_seq`, created in the first migration. Seed data uses `EMP000`–`EMP015`.
- **`department`** is a free-text column, not a separate table.
- **Indexes:** `User.role`, `Employee.managerId`, `Employee.department`, `Employee.status`.

## 8. API Documentation

- **Swagger UI:** `http://localhost:4000/api/docs` (public). Log in with `POST /auth/login`, click **Authorize** and paste the token. You can then call every route from the page.
- **Raw OpenAPI 3.0:** `http://localhost:4000/api/docs.json`. Source file: [`backend/openapi.yaml`](backend/openapi.yaml).

All routes are under `/api`. Every route except login and docs requires `Authorization: Bearer <token>`.

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/auth/login` | anyone | Returns `{ token, expiresIn, user }` |
| `POST` | `/auth/logout` | any role | 204. The client discards its token |
| `GET` | `/me` | any role | The caller's own record, looked up by the ID in the token |
| `GET` | `/employees` | any role | Scoped in SQL. `?search=&department=&status=&page=&limit=` can only narrow the results |
| `GET` | `/employees/{id}` | any role | 403 / 404 rule above |
| `POST` | `/employees` | ADMIN | 201 + `Location` header. Creates the employee and their login |
| `PUT` | `/employees/{id}` | per field | Partial update. A field the caller may not change returns 403 naming it |
| `DELETE` | `/employees/{id}` | ADMIN | 204. Soft delete |
| `GET` | `/dashboard/stats` | any role | `{ total, active, inactive, byDepartment[] }`, scoped |
| `GET` | `/health` (root, not `/api`) | anyone | Liveness check |

Every error uses the same body: `{ "error": { "code", "message", "details"? } }`.

## 9. Setup & Installation

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or newer | |
| npm | 10 or newer | |
| PostgreSQL | 14+ | Built and tested on **Supabase**. Any Postgres works if you provide both connection strings |

No Docker or local database is needed; the app connects to a hosted database.

### Install

```bash
git clone https://github.com/harshreinvent-sys/hrms.git
cd hrms
cd backend && npm install
cd ../frontend && npm install
```

> On npm 11, the `backend` install may skip some install scripts. Prisma and bcrypt need them, so approve them:
> ```bash
> npm install-scripts approve @prisma/client prisma @prisma/engines esbuild bcrypt
> ```

### Configure

Copy the environment templates and fill them in (see [section 10](#10-environment-variables)):

```bash
cp backend/.env.example backend/.env
cp backend/.env.test.example backend/.env.test
cp frontend/.env.example frontend/.env
```

### Database

From `backend/`:

```bash
npx prisma migrate deploy   # creates tables, indexes, FKs and employee_id_seq
npx prisma db seed          # 16 employees across 5 departments; safe to re-run
```

### Run

```bash
# Terminal 1 — backend/  → http://localhost:4000
npm run dev

# Terminal 2 — frontend/ → http://localhost:5173
npm run dev
```

| Backend command | Purpose |
|---|---|
| `npm run build` then `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type-check source **and** tests |
| `npm run lint` | ESLint |

On the frontend, `npm run build` writes the production build to `dist/`, and `npm run lint` runs oxlint.

## 10. Environment Variables

Templates are committed to the repo. The real `.env` files are git-ignored. The backend validates its environment at startup ([`backend/src/config/env.ts`](backend/src/config/env.ts)); if a value is missing or invalid, the server stops and names it.

### `backend/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Pooled** connection (Supabase port 6543, Transaction mode). Must include `?pgbouncer=true`. Keep the template's `connection_limit=15&pool_timeout=30`; Prisma's default pool of 9 connections runs out during normal frontend use. |
| `DIRECT_URL` | **Direct** connection (port 5432), used by `prisma migrate` |
| `JWT_SECRET` | At least 32 characters. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_EXPIRES_IN` | Access-token lifetime. Default `30m` |
| `PORT` | Default `4000` |
| `CORS_ORIGIN` | Comma-separated allowed origins. Default `http://localhost:5173` |
| `LOG_LEVEL` | `silent \| fatal \| error \| warn \| info \| debug \| trace`. Default `info` |

### `backend/.env.test`

Same variables as `backend/.env`, but set **both** URLs to the direct connection and append `?schema=test`. The test runner will not start unless both URLs contain `schema=test`, so tests cannot touch your real data. Tests use the direct connection because Supabase's pooler rejects Prisma's schema option.

### `frontend/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL. Default `http://localhost:4000/api` |

## 11. Test Credentials

All five accounts use the password **`Password@123`**.

| Email | Role | Employee ID | Reports to | Can see |
|---|---|---|---|---|
| `admin@company.com` | HR / Admin | EMP000 | — | everyone |
| `manager@company.com` | Manager | EMP010 | EMP000 | self + EMP001 + EMP002 |
| `employee1@company.com` | Employee | EMP001 | EMP010 | self |
| `employee2@company.com` | Employee | EMP002 | EMP010 | self |
| `employee3@company.com` | Employee | EMP003 | EMP000 (**not** on the manager's team) | self |

The seed also creates eleven employees without published logins (EMP004–EMP009, EMP011–EMP015), two of which are `INACTIVE`. The login page lists the demo accounts in a collapsible section.

## 12. Authorization Test Cases

Rows **1–6** are the six required scenarios from the brief. Every row is an automated test in [`backend/tests/integration/authorization.test.ts`](backend/tests/integration/authorization.test.ts), where the required ones are tagged `[Spec Test n]`. Each can also be run by hand from Swagger UI.

| # | Login as | Request | Expected | Why |
|---|---|---|---|---|
| **1** | employee1 | `GET /api/employees/EMP001` | **200** | own record |
| **2** | employee1 | `GET /api/employees/EMP002` | **403** | another employee; the response contains no employee data |
| **3** | employee1 | `POST /api/employees` | **403** | only ADMIN can create; nothing is written |
| **4** | admin | `GET /api/employees/EMP002` | **200** | ADMIN sees everyone |
| **5** | admin | `POST /api/employees` | **201** | `Location` header; the new login works immediately |
| **6** | manager | `GET /api/employees/EMP003` | **403** | EMP003 reports to EMP000, not to the manager |
| | manager | `GET /api/employees/EMP001` | 200 | direct report |
| | employee1 | `PUT /api/employees/EMP002` | 403 | object-level |
| | employee1 | `PUT /api/employees/EMP001 { "role": "ADMIN" }` | 403 | field-level: `details: [{ path: "role" }]`; same for `managerId` and `status` |
| | employee1 | `PUT /api/employees/EMP001 { "phone": … }` | 200 | the only field an employee may change |
| | manager | `PUT /api/employees/EMP001 { "designation": … }` | 200 | allowed on a direct report |
| | manager | `PUT /api/employees/EMP001 { "phone": … }` | 403 | not allowed on a report |
| | employee1 | `GET /api/employees` | 200, one row | scoped in SQL |
| | manager | `GET /api/employees` | 200, self + team | EMP003 never appears, even with `?search=` |
| | anyone | no token, or an expired or tampered one | 401 | |
| | anyone | token of a user who has since been deactivated | 401 | `isActive` is checked on every request |

## 13. Running Tests

From `backend/`:

```bash
npm run test:unit
```
Runs **46** unit tests that need no database. They cover every branch of the authorization policy and the error handler.

```bash
npm test
```
Runs the unit tests plus **116** integration tests that go through the real HTTP stack against the `test` schema: auth (17), authorization (57, including the six required scenarios), employee behaviour (30) and dashboard (6). Each run first rebuilds the `test` schema **from the migration files** and seeds it, so it also checks the migrations. A run takes 2–4 minutes against a remote database.

> If you run `npm test` from an AI coding agent, Prisma's safety guard stops the schema reset and asks for explicit consent. This does not happen in a normal terminal.

## 14. Design Decisions / Trade-offs

The main design decisions:

| Decision | Why | Trade-off |
|---|---|---|
| All authorization rules in one file, written as pure functions (`employeePolicy.ts`) | The rules can be reviewed in one place and unit-tested without a database | The frontend keeps a copy in `lib/permissions.ts` for display, which must be kept in sync |
| `role` stored only on `User` | The JWT and the policy read a single source of truth | An employee cannot exist without a login |
| Employee IDs from a Postgres sequence | No race conditions, and clients cannot choose IDs | One raw SQL statement in the migration and a `$queryRaw` call |
| 403 instead of 404 outside a caller's scope | Callers cannot discover which IDs exist | A manager who mistypes an ID sees 403 rather than 404 |
| `PUT` is partial and `.strict()` | Blocks mass assignment; a mistyped field name returns 400 | Behaves like `PATCH` despite the `PUT` method |
| `department` as a string | Kept simple; the brief doesn't ask for a department table | Free-text values can drift ("Sales" vs "sales") |
| Soft delete + `isActive` checked on every request | A deactivated user loses access immediately | One indexed lookup per request |
| Email and status changes copied to the login | A deactivated or renamed employee's login stays consistent | Email is stored in two tables |
| Express 4 + CommonJS | Established typings and a simple Jest setup | Every async route needs `asyncHandler` |
| Tests rebuild the schema with `migrate reset` | The test run checks the real migration files | Slower than `db push` |
| Stateless JWTs, no refresh tokens | Simple | Logout is client-side only; sessions last up to 30 minutes |

The frontend uses its own visual style: a warm paper background, ink text, one terracotta accent colour, thin rules instead of shadows, a serif font for headings and a monospace font for IDs.

### Known limitations

- **Latency.** Each request takes 2–7 s against Supabase from a distant machine, due to network round trips and bcrypt on login. Hosting the API close to the database would fix this.
- **Two accepted `npm audit` findings** in `backend`: `@mapbox/node-pre-gyp` (used only by bcrypt at install time) and `@prisma/config` (no fix is compatible with Prisma 6.19).
- **Frontend bundle** is a single ~510 kB chunk.

## 15. Future Improvements

- Refresh tokens with rotation, plus revoking tokens on the server at logout.
- Code-splitting the frontend bundle by route.
- A `Department` table with a foreign key in place of free text.
- Letting managers see their whole reporting chain, not just direct reports.
- Password reset and change-password flows; lockout after repeated failed logins.
- Audit log of who changed which field, and when.
- Hosting the API in the same region as the database to cut latency.
- CI pipeline running lint, typecheck and unit tests on every push, with integration tests against an isolated database.
- More HR modules (attendance, leave, org chart), each going through the policy layer.
