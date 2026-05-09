# PreExisting TechStack — Web_repair_center

**Maintained by:** Monolith (AT/SC/EN/PF)
**Source root:** `c:/Web_repair_center/ticket-system/`
**Codebase classification:** M (Medium — ~20 .ts/.tsx files in src/)
**Initial scan tier:** L1 (Broad Scan)
**Last reviewed:** 09-05-2026

---

## Overview

Web_repair_center คือระบบศูนย์แจ้งซ่อมบำรุงของ Villa Market JP (มหาชน) แบบ web-based — สาขาแจ้งงานซ่อม, ทีมช่างรับงานและอัปเดตสถานะ, แอดมินดูแลและมอบหมาย คล้าย ticket-helpdesk แต่ลงทุน LINE LIFF integration เพื่อใช้งานในโทรศัพท์มือถือพนักงานสาขา

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Server Actions) | 16.1.6 |
| UI library | React | 19.2.3 |
| Language | TypeScript | ^5 |
| Database | PostgreSQL via Supabase | (managed) |
| ORM | Prisma | ^5.22.0 |
| Auth | Custom cookie session (NO NextAuth) | — |
| Mobile integration | LINE LIFF | @line/liff ^2.27.3 |
| Notifications | LINE Messaging API + in-app | — |
| Storage | Supabase Storage | @supabase/supabase-js ^2.100.0 |
| Image format | HEIC support | heic2any ^0.0.4 |
| Drag & drop | @hello-pangea/dnd | ^18.0.1 |
| Signature | react-signature-canvas | ^1.1.0-alpha.2 |
| Icons | lucide-react | ^0.577.0 |
| Linter | ESLint | ^9 + eslint-config-next |

## Entry Points

| File | Purpose |
|------|---------|
| `package.json` | npm scripts — `dev`, `build` (= prisma generate + next build), `start`, `lint`, `seed` |
| `next.config.ts` | Next.js config |
| `prisma/schema.prisma` | Database schema (single source of truth for DB structure) |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Landing page (เลือกระหว่าง พนักงานสาขา / Admin) |
| `eslint.config.mjs` | ESLint flat config |

## Top-Level Directory (depth 3)

```
ticket-system/
├── prisma/
│   └── schema.prisma          # 6 models, postgres provider
├── public/                    # static assets (logo.png, etc.)
├── src/
│   ├── app/
│   │   ├── actions/           # Server Actions (auth.ts, tickets.ts)
│   │   ├── admin/dashboard/   # 765 LOC — full admin UI
│   │   ├── api/
│   │   │   ├── proxy-image/   # image proxy route
│   │   │   └── webhook/       # 25 LOC webhook receiver
│   │   ├── login/             # login page
│   │   ├── technician/dashboard/  # 513 LOC
│   │   ├── user/
│   │   │   ├── dashboard/     # 514 LOC
│   │   │   └── new-ticket/    # ticket creation form
│   │   ├── layout.tsx
│   │   └── page.tsx           # landing
│   ├── components/
│   │   ├── HeicViewerModal.tsx
│   │   ├── LiffProvider.tsx
│   │   ├── NavBar.tsx
│   │   ├── NotificationBell.tsx
│   │   └── SignatureModal.tsx
│   └── lib/
│       ├── lineNotify.ts      # LINE Messaging API client
│       ├── prisma.ts          # singleton client
│       ├── seed.ts            # data seeding
│       └── supabase.ts        # supabase client
├── check_db.ts                # ad-hoc DB inspection script
├── clear_old_tickets.ts       # ad-hoc cleanup script
├── delete_90xx.mjs            # ad-hoc deletion script
├── seed_production.mjs        # production seed
├── seed_technicians.js        # technician seed
└── package.json
```

---

## Subsystems

### Auth
**Source files:** `src/app/actions/auth.ts`, `src/app/login/page.tsx`
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
Custom cookie-based authentication ด้วย username + password เก็บใน Prisma User model. Server Actions ใน `auth.ts` รับผิดชอบ login/logout/getSession. Session เก็บเป็น JSON ใน httpOnly cookie ชื่อ `user_session` อายุ 1 วัน

#### Architecture / Data Flow
```
User submits form (login/page.tsx)
  ↓
Server Action: login(username, password)
  ↓
prisma.user.findFirst({ where: { Username }, include: { Branch } })
  ↓
[CRITICAL] Plaintext compare: user.Password !== password
  ↓ (success)
Build sessionData JSON {userId, username, displayName, role, branchId, branchName}
  ↓
cookies().set("user_session", ..., { httpOnly, secure, maxAge })
  ↓
Return { redirect: '/admin/dashboard' | '/technician/dashboard' | '/user/dashboard' }
```

#### Key Functions / Classes
| Name | File | What it does |
|------|------|--------------|
| `login(username, password)` | actions/auth.ts:5 | Authenticate, set session cookie, return role-based redirect |
| `logout()` | actions/auth.ts:62 | Delete session cookie |
| `getSession()` | actions/auth.ts:67 | Read & parse session cookie |

#### Critical Invariants
- `user_session` cookie httpOnly + secure (production) — must NOT be readable by JS
- Role values: `'Admin'`, `'Technician'`, `'User'` — used for routing decisions
- Session JSON shape stable — dashboards parse this directly

#### Known Quirks / Gotchas
- ⚠️ **Password comparison is plaintext** (auth.ts:18) — `user.Password !== password` — NO bcrypt/argon2 hashing
- ⚠️ **Default password "1234"** in schema — `Password String @default("1234")`
- Hardcoded technician name mapping `techMapping` (auth.ts:22-32) — Thai display names อิง username
- Comment ที่ auth.ts:7 พูดถึง "MSSQL" แต่จริงๆ ใช้ PostgreSQL/Supabase — ค้างจาก migration เดิม

---

### Tickets (Repair Tickets)
**Source files:** `src/app/actions/tickets.ts` (259 LOC), `src/app/user/new-ticket/page.tsx`, `src/app/user/dashboard/page.tsx`
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
CRUD + listing สำหรับ RepairTicket. Server Actions ใน `tickets.ts` รับผิดชอบ create, fetch by branch, update status, comments, history

#### Architecture / Data Flow
```
Branch user → /user/new-ticket → form submit → createTicket(formData)
  ↓
[Auto-create user] if no user exists for branchId, create one (Role='User')
  ↓
prisma.repairTicket.create({ ... CurrentStatus: 'Open', Priority: 'Medium' ... })
  ↓
prisma.notification.create({ TargetRole: 'Admin', ... }) — in-app notification
  ↓
[LINE Notify currently DISABLED — see comment line 4]
```

#### Key Functions / Classes
| Name | File | What it does |
|------|------|--------------|
| `createTicket(formData)` | actions/tickets.ts:6 | Create ticket + admin notification |
| `getBranchTickets(branchId)` | actions/tickets.ts:63 | List tickets for a branch (with comments + history) |
| (more functions exist past line 80 — L2 scan needed) | tickets.ts:80+ | (UNREAD in L1) |

#### Critical Invariants
- Status transitions: `Open` → `Planed` → ... (default `Planed` ตาม schema, but `createTicket` sets `Open` — schema/code mismatch?)
- Priority values: `Medium` (default) — เปลี่ยนได้แต่ไม่ documented
- Auto-create user side-effect: createTicket อาจจะสร้าง User record ถ้าไม่มี — silent

#### Known Quirks / Gotchas
- 🐛 **LINE Notify disabled** ใน createTicket (line 4 comment-out) — branches ไม่ได้รับ notification ผ่าน LINE
- 🐛 **Schema/code mismatch** — schema default status = `'Planed'` (typo? planned?) แต่ createTicket set เป็น `'Open'`
- 🐛 **Silent user creation** — createTicket auto-creates User if missing (tickets.ts:19-27) ซึ่งเป็น side-effect ที่ไม่คาดคิด

---

### Admin Dashboard
**Source files:** `src/app/admin/dashboard/page.tsx` (765 LOC) — single file UI
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
หน้า admin หลัก — view all tickets, filter by status/branch/technician, assign technician, update status, view comments, drag-drop status board

#### Critical Invariants
- (L2 scan needed for full picture)

#### Known Quirks / Gotchas
- ⚠️ **765 LOC single file approaching rewrite threshold** — ตาม `rules/debugging.md` Rewrite Threshold #4: "Single file exceeds 1000 lines with mixed concerns" → flag for rewrite. ปัจจุบัน 765 — ยังไม่ถึง threshold แต่ใกล้ ควร refactor เป็น sub-components ใน mod-log

---

### Technician Dashboard
**Source files:** `src/app/technician/dashboard/page.tsx` (513 LOC)
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
หน้าช่าง — view assigned tickets, update status (in progress/done), upload signature, add comments

#### Known Quirks / Gotchas
- 513 LOC — manageable แต่ควร monitor

---

### User Dashboard (Branch staff)
**Source files:** `src/app/user/dashboard/page.tsx` (514 LOC), `src/app/user/new-ticket/page.tsx`
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
หน้าพนักงานสาขา — แจ้งซ่อมใหม่, ดูสถานะของสาขาตัวเอง, comment, อัปโหลดรูป, ดู history

---

### Notifications
**Source files:** `src/lib/lineNotify.ts`, `src/components/NotificationBell.tsx`, Prisma `Notification` model
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
ระบบแจ้งเตือน 2 ทาง: (1) ในแอป — เก็บใน Notification table, แสดงผ่าน NotificationBell component (2) LINE — ส่งผ่าน LINE Messaging API (push/multicast) ไปยัง LINE_TARGET_ID

#### Architecture / Data Flow
```
[Server-side trigger]
  → sendLineNotify(message)
    → token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    → targets = process.env.LINE_TARGET_ID.split(',')
    → POST https://api.line.me/v2/bot/message/{push|multicast}
    → [silent fail if token missing — only console.warn]

[In-app]
  → prisma.notification.create({ TargetRole, TargetUser, Title, Message, TicketID })
  → NotificationBell polls / fetches → displays badge
```

#### Critical Invariants
- LINE_CHANNEL_ACCESS_TOKEN required for LINE delivery
- LINE_TARGET_ID is comma-separated user IDs (multicast if > 1)
- TargetRole = `'Admin'` | `'Branch'` (or null)

#### Known Quirks / Gotchas
- 🐛 **Silent failure** — lineNotify.ts:5-8 returns silently with only console.warn if token missing. Per §2 Silent Failure Rule = CRITICAL — ต้องเพิ่ม structured error
- ⚠️ **LINE Notify call commented out** ใน createTicket (tickets.ts:4) — feature dead code

---

### LIFF Integration
**Source files:** `src/components/LiffProvider.tsx`
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
Bootstrapping LINE LIFF SDK ในฝั่ง client — ใช้ NEXT_PUBLIC_LIFF_ID. ใช้สำหรับเปิดแอปผ่าน LINE app

#### Critical Invariants
- NEXT_PUBLIC_LIFF_ID ต้องตั้งค่าก่อน LIFF จะ init

---

### Webhook
**Source files:** `src/app/api/webhook/route.ts` (25 LOC)
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
HTTP endpoint สำหรับรับ webhook (น่าจะจาก LINE Messaging API หรือ external system) — L2 scan needed

---

### Image / Media
**Source files:** `src/components/HeicViewerModal.tsx`, `src/app/api/proxy-image/route.ts`
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
HEIC image viewer modal (heic2any conversion) + proxy endpoint สำหรับโหลดรูปจาก external URL (น่าจะ Supabase Storage)

---

### Database (Prisma + PostgreSQL via Supabase)
**Source files:** `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/supabase.ts`
**Scan tier completed:** L1
**Last reviewed:** 09-05-2026

#### Purpose
Prisma client singleton + Supabase client. PostgreSQL hosted on Supabase. Prisma schema มี 6 models

#### Schema Overview (6 models)

```
Branch (BranchID PK, BranchName)
  ↓ 1:N
User (UserID PK, Username UNIQUE, Password, Role, BranchID FK, CreatedAt)
  ↓ 1:N (UserID)
RepairTicket (TicketID PK, UserID FK, BranchID FK,
              Product, Symptom, Description, ImageURL,
              Priority='Medium', CurrentStatus='Planed',
              RequestDate, ActualDate, SLA_Deadline, TotalCost, CSAT_Score,
              Technician, AdminSignature, UserSignature, CreatedAt)
              indexes: BranchID, Technician, CurrentStatus
  ↓ 1:N
TicketHistory (HistoryID PK, TicketID FK, Status, UpdatedBy, Note, Timestamp)

TicketComment (CommentID PK, TicketID FK, UserID FK, Message, ImageURL, Timestamp)

Notification (NotifID PK, TargetRole, TargetUser, Title, Message, TicketID, IsRead, CreatedAt)
```

#### Critical Invariants
- TicketID, BranchID = `cuid()` (Prisma)
- UserID = `uuid()` (Prisma)
- onDelete/onUpdate = NoAction บน foreign keys → ต้อง manual cascade
- DATABASE_URL = pooled connection, DIRECT_URL = direct (สำหรับ migrations)

#### Known Quirks / Gotchas
- ⚠️ Password plaintext (security), default `'1234'`
- ⚠️ Password ไม่มี `@unique` หรือ index (ok เพราะ password)
- 🐛 Default CurrentStatus = `'Planed'` (typo? น่าจะ "Planned") — code ใช้ `'Open'` แทน → mismatch
- Branch.BranchName ไม่ unique — สาขาชื่อซ้ำได้
- ad-hoc scripts ที่ root: `check_db.ts`, `clear_old_tickets.ts`, `delete_90xx.mjs` → ไม่ใช่ part ของ build แต่ commit ไว้ — ควร flag เป็น tech debt

---

## Environment Variables (จาก grep `process.env`)

| Variable | Used in | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | prisma/schema.prisma | Pooled Postgres connection |
| `DIRECT_URL` | prisma/schema.prisma | Direct connection for migrations |
| `NEXT_PUBLIC_LIFF_ID` | components/LiffProvider.tsx | LINE LIFF app ID |
| `LINE_CHANNEL_ACCESS_TOKEN` | lib/lineNotify.ts | LINE Messaging API token |
| `LINE_TARGET_ID` | lib/lineNotify.ts | Comma-separated LINE user IDs |
| `NEXT_PUBLIC_SUPABASE_URL` | lib/supabase.ts | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lib/supabase.ts | Supabase anon key |
| `NODE_ENV` | auth.ts, lib/prisma.ts | Standard Node env |

---

## L2 Recommendations

L1 scan classified codebase as **M** (Medium ~20 src files). Per §5: **L2 default, L3 on Commander request**

### L2 priorities (suggested for future phases)
1. Read full `tickets.ts` (259 LOC) — server actions ทั้งหมด
2. Read all 3 dashboard pages — understand state management, data flow
3. Map webhook handler — เชื่อมต่อกับอะไร
4. Map Supabase Storage usage — image URLs ของ ticket
5. Document onMount/state management patterns ของแต่ละ dashboard

L2 ไม่จำเป็นสำหรับ Phase 0/0.5 — Phase 0 เป็น docs only, Phase 0.5 ต้องการแค่ความรู้เกี่ยวกับ auth flow ซึ่ง L1 covered แล้ว

---

## Critical Issues Summary (สำหรับ Phase 0.5+)

| # | Severity | Issue | Subsystem |
|---|----------|-------|-----------|
| 1 | 🔴 CRITICAL | Plaintext password storage + comparison | Auth |
| 2 | 🔴 CRITICAL | Default password `"1234"` in schema | Auth/DB |
| 3 | 🟡 HIGH | LINE Notify silent failure (no token = silent skip) | Notifications |
| 4 | 🟡 HIGH | Schema/code status mismatch (`Planed` vs `Open`) | Tickets/DB |
| 5 | 🟢 MEDIUM | LINE Notify in createTicket commented-out (dead code) | Notifications |
| 6 | 🟢 MEDIUM | Silent user creation in createTicket | Tickets |
| 7 | 🟢 MEDIUM | admin/dashboard 765 LOC approaching rewrite threshold | Admin Dashboard |
| 8 | 🟢 MEDIUM | Stale comment "MSSQL" in auth.ts (actually Postgres) | Auth |
| 9 | 🔵 LOW | Ad-hoc scripts at ticket-system/ root not gitignored | Tooling |
