# Local Setup Guide

This guide takes you from a fresh clone to the app running on your machine, logged in, with the six authorization scenarios ready to try in Swagger. It takes about 10 minutes.

When you're done you'll have:

| What | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:4000/api |
| Swagger UI | http://localhost:4000/api/docs |

---

## 1. Tech stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend** | React | 19 |
| | TypeScript | 6 |
| | Vite (dev server and build) | 8 |
| | Tailwind CSS | 3 |
| | TanStack Query (server state, caching) | 5 |
| | React Router | 7 |
| | React Hook Form + Zod (forms and validation) | 7 / 4 |
| | Axios (HTTP client with auth interceptors) | 1 |
| **Backend** | Node.js | 20+ |
| | Express | 4 |
| | TypeScript | 5 |
| | Zod (request validation) | 3 |
| | JSON Web Tokens (`jsonwebtoken`) | 9 |
| | bcrypt (password hashing, cost 12) | 5 |
| | pino (structured logging) | 9 |
| | helmet, cors (security headers, CORS) | — |
| | Swagger UI (`swagger-ui-express`), serving a hand-written OpenAPI 3.0 spec | 5 |
| **Database** | PostgreSQL | 14+ |
| | Prisma (ORM and migrations) | 6 |
| **Testing** | Jest + ts-jest | 29 |
| | Supertest (HTTP integration tests) | 7 |
| **Tooling** | ESLint (backend), oxlint (frontend) | — |

How the pieces connect:

```
Browser ──▶ React app (Vite, :5173) ──HTTP + Bearer JWT──▶ Express API (:4000) ──Prisma──▶ PostgreSQL
                                                              │
                                                              └── /api/docs  Swagger UI
```

---

## 2. Prerequisites

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20 or newer | `node -v` |
| npm | 10 or newer (ships with Node) | `npm -v` |
| Git | any | `git --version` |
| PostgreSQL | 14+. Use **Docker** (option A) or a free **Supabase** project (option B) | — |

---

## 3. Clone the repository

```bash
git clone https://github.com/Harsh1652/HRMS.git
cd HRMS
```

---

## 4. Start a database

Choose **one** option.

### Option A: Local PostgreSQL with Docker (recommended)

This needs no account. Start a container:

```bash
docker run -d --name hrms-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hrms -p 5432:5432 postgres:16-alpine
```

In step 5 you'll use this value for **both** `DATABASE_URL` and `DIRECT_URL`:

```
postgresql://postgres:postgres@localhost:5432/hrms
```

> If port 5432 is already in use by another Postgres, change it to `-p 5433:5432` and use `localhost:5433` in the URL.

### Option B: Supabase (hosted PostgreSQL)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **Connect** (top bar) and copy two connection strings:
   - **Transaction pooler** (port **6543**). This is your `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=15&pool_timeout=30`.
   - **Session pooler** (port **5432**, same host). This is your `DIRECT_URL`, used for migrations.

> - Use the **session pooler**, not the "Direct connection" (`db.<ref>.supabase.co`). On the free plan the direct host is IPv6-only, and many networks can't reach it.
> - If your database password contains special characters such as `@`, `#` or `%`, URL-encode them. For example `@` becomes `%40`: `pass@123` → `pass%40123`.

---

## 5. Backend setup

The backend setup has four parts: install and configure, create the tables, load the seed data, start the API. Run everything from the `backend/` folder.

### 5.1 Install and configure

```bash
cd backend
npm install
```

Create the environment file from the template:

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Open `backend/.env` and set these values:

| Variable | Value |
|---|---|
| `DATABASE_URL` | From step 4 (Docker: `postgresql://postgres:postgres@localhost:5432/hrms`) |
| `DIRECT_URL` | From step 4 (Docker: the same URL as above) |
| `JWT_SECRET` | Any random string of **32+ characters**. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

Leave the other values (`PORT=4000`, `JWT_EXPIRES_IN=30m`, `CORS_ORIGIN=http://localhost:5173`, `LOG_LEVEL=info`) as they are.

### 5.2 Create the tables

```bash
npx prisma generate          # builds the typed database client from prisma/schema.prisma
npx prisma migrate deploy    # applies prisma/migrations/: tables, indexes, foreign keys, EMP id sequence
```

The migration creates the `User` and `Employee` tables, the `Role` and `EmploymentStatus` enums, and the `employee_id_seq` sequence that generates new employee IDs (`EMP100`, `EMP101`, …). The database is empty at this point.

### 5.3 Load the seed data

The seed script ([`prisma/seed.ts`](backend/prisma/seed.ts)) fills the empty tables with a small company, so every role has data to log in and try. Run:

```bash
npx prisma db seed
```

(`npm run db:seed` does the same thing.)

Expected output:

```
Seed complete: 16 employees, 16 users.
Login accounts (password: Password@123):
  admin@company.com        ADMIN     EMP000  reports to —
  manager@company.com      MANAGER   EMP010  reports to EMP000
  employee1@company.com    EMPLOYEE  EMP001  reports to EMP010
  employee2@company.com    EMPLOYEE  EMP002  reports to EMP010
  employee3@company.com    EMPLOYEE  EMP003  reports to EMP000
```

**What gets created:**

| Data | Details |
|---|---|
| **16 employees** (`EMP000`–`EMP015`) | Spread across 5 departments: HR, Engineering, Finance, Sales, Marketing |
| **Reporting lines** | `EMP010` (Manager) manages exactly `EMP001` and `EMP002`. `EMP003` reports to the Admin, so it's outside the manager's team (used in scenario 6). |
| **Statuses** | 14 `ACTIVE`, 2 `INACTIVE` (`EMP012`, `EMP013`), so the dashboard and status filter have something to show |
| **5 login accounts** | The users in [step 7](#7-sign-in), all with password `Password@123` (bcrypt-hashed, never stored as plain text) |
| **11 other employees** | They also have a `User` row, which holds their role, but with a random password nobody knows, so they can't log in |

**Running it again is safe.** The script uses upserts (insert, or update if the row exists), so you can run it as often as you like:
- It resets the 16 seeded employees and the 5 demo passwords to their original values. Use this if you've edited or deactivated a seeded employee while testing.
- Employees you created yourself (`EMP100` and up) are left alone.

**Start again from an empty database** (deletes **all** data, re-applies the migration, then runs the seed automatically):

```bash
npx prisma migrate reset
```

**Look at the data** in a browser table view (opens http://localhost:5555):

```bash
npx prisma studio
```

### 5.4 Start the API

```bash
npm run dev
```

You should see `HRMS API listening on http://localhost:4000`. To check it, open http://localhost:4000/health, which should return `{"status":"ok",...}`.

> The server checks its environment at startup. If a value is missing or wrong, it stops with a message naming the variable.

---

## 6. Frontend setup

In a **second terminal**, from the repository root:

```bash
cd frontend
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

The template's `VITE_API_URL=http://localhost:4000/api` already points to the backend, so you don't need to change it.

Open **http://localhost:5173**.

---

## 7. Sign in

All five accounts use the password **`Password@123`**.

| Email | Role | Employee ID | Reports to | Can see |
|---|---|---|---|---|
| `admin@company.com` | HR / Admin | EMP000 | — | everyone |
| `manager@company.com` | Manager | EMP010 | EMP000 | self + EMP001 + EMP002 |
| `employee1@company.com` | Employee | EMP001 | EMP010 | self only |
| `employee2@company.com` | Employee | EMP002 | EMP010 | self only |
| `employee3@company.com` | Employee | EMP003 | EMP000 (outside the manager's team) | self only |

The login page also lists these accounts; click one to fill in the form.

**Things to try in the UI:**
- **Admin:** use the employee list (search, filter by department or status), view an employee, edit any field, deactivate an employee, add a new one.
- **Manager:** you see only your team. You can edit a report's designation and department, and your own phone.
- **Employee:** you see only your own profile and can edit only your phone. Going to `/employees` redirects you away.

---

## 8. Run the six authorization scenarios in Swagger

1. Open http://localhost:4000/api/docs.
2. Expand **`POST /auth/login`**, click **Try it out**, and send:
   ```json
   { "email": "employee1@company.com", "password": "Password@123" }
   ```
3. Copy the `token` from the response. Click **Authorize** (top right), paste the token and click **Authorize**.
4. Run the requests below. To switch user, repeat steps 2–3 with that user's email.

| # | Log in as | Request | Expected |
|---|---|---|---|
| 1 | employee1 | `GET /employees/{id}` with `EMP001` | **200** own record |
| 2 | employee1 | `GET /employees/{id}` with `EMP002` | **403** another employee |
| 3 | employee1 | `POST /employees` (body below) | **403** only Admin can create |
| 4 | admin | `GET /employees/{id}` with `EMP002` | **200** Admin sees everyone |
| 5 | admin | `POST /employees` (body below) | **201** created, new id like `EMP100` |
| 6 | manager | `GET /employees/{id}` with `EMP003` | **403** not in the manager's team |

Body for scenarios 3 and 5:

```json
{
  "firstName": "Ravi",
  "lastName": "Menon",
  "email": "ravi.menon@company.com",
  "department": "Engineering",
  "designation": "Software Engineer",
  "joiningDate": "2026-09-01",
  "managerId": "EMP000",
  "password": "Welcome@12345"
}
```

> Re-running scenario 5 with the same email returns **409** (duplicate email). Change the email to create another employee.

**Other checks worth a look:**
- As employee1, `PUT /employees/{id}` on `EMP001` with `{ "role": "ADMIN" }` → **403**, and the response names the forbidden field.
- As employee1, `GET /employees/{id}` with `EMP999` (doesn't exist) → **403**, the same body as a real ID, so callers can't tell which IDs exist. As admin → **404**.
- Call any endpoint without a token → **401**.

---

## 9. Run the tests (optional)

From `backend/`:

```bash
npm run test:unit
```

This runs 69 unit tests covering every branch of the authorization policy, the error handler and the field validation rules. It needs no database or `.env`.

```bash
npm test
```

This adds the integration tests, which go through the real HTTP stack, including all six scenarios above. They need `backend/.env.test`:

```bash
cp .env.test.example .env.test
```

In `.env.test`, set both URLs to your database with **`?schema=test`** appended. For Docker, that's `postgresql://postgres:postgres@localhost:5432/hrms?schema=test`. The test run wipes and re-seeds only the `test` schema, and it refuses to start unless both URLs contain `schema=test`, so your main data is never touched.

---

## 10. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Invalid environment configuration: JWT_SECRET ...` | The secret is shorter than 32 characters. Generate one with the command in step 5. |
| `P1001: Can't reach database server` | The database isn't running or the URL is wrong. On Docker, check `docker ps`. On Supabase, use the **session pooler** host, not `db.<ref>.supabase.co` (IPv6-only). |
| `invalid domain character in database URL` | The password has an unencoded special character. URL-encode it (`@` → `%40`). |
| `@prisma/client did not initialize yet` | Run `npx prisma generate` in `backend/`. |
| Login page says *"Cannot reach the API"* | The backend isn't running on :4000, or `VITE_API_URL` in `frontend/.env` is wrong. Restart `npm run dev` after changing `.env`. |
| Browser shows a CORS error | The frontend runs on a different URL than `CORS_ORIGIN` in `backend/.env`. Make them match. |
| `EADDRINUSE: port 4000` | Something else is using the port. Change `PORT` in `backend/.env`, and update `VITE_API_URL` to match. |
| Seed users can't log in | Re-run `npx prisma db seed`. It's safe to repeat and resets the five demo passwords. |
