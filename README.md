# Web Repair Center

ระบบศูนย์แจ้งซ่อมบำรุงของ **Villa Market JP** — ticket-helpdesk แบบ web พร้อม LINE LIFF integration สำหรับใช้งานบนมือถือพนักงานสาขา

## Overview

| Side | Who | Capability |
|------|-----|-----------|
| สาขา | พนักงานสาขา (Branch staff) | แจ้งซ่อมอุปกรณ์ ติดตามสถานะ คอมเมนต์ อัปโหลดรูป |
| ทีมช่าง | Technician | รับงาน อัปเดตสถานะ เซ็นรับงาน |
| Admin | ผู้ดูแล | จัดการ ticket ทั้งหมด มอบหมายช่าง ดูภาพรวม |

## Tech Stack

- **Framework:** Next.js 16 (App Router + Server Actions) · React 19 · TypeScript
- **Database:** PostgreSQL on Supabase · Prisma ORM 5
- **Auth:** Custom cookie session
- **Mobile:** LINE LIFF SDK
- **Notifications:** LINE Messaging API + in-app
- **Storage:** Supabase Storage
- **UI:** lucide-react · @hello-pangea/dnd · react-signature-canvas · heic2any

## Repository Layout

```
Web_repair_center/
├── ticket-system/           # Next.js application (source code)
│   ├── prisma/schema.prisma
│   ├── src/
│   ├── public/
│   └── package.json
├── Development/             # Planning, tickets, audits, tech-stack docs
│   └── Web_repair_center/
│       ├── 01_Implementation Logs/
│       ├── 02_FeatureDescription/
│       ├── 03_SubFeatures Implementation/
│       ├── 04_Modification Logs/
│       ├── 05_BugFixesLog/
│       ├── 06_InstallationGuide/
│       ├── 07_TechnicalDebt/
│       ├── 08_AuditReport/
│       ├── 09_TestCase/
│       ├── PreExisting TechStack/
│       └── ErrorCatalog.md
├── RoundTable/              # Daily session logs (governance audit trail)
├── .claude/                 # RoundTable Framework — multi-team AI governance
│   ├── CLAUDE.md
│   ├── ProjectEnvironment.md
│   ├── UserProfile.md
│   ├── agents/, policies/, rules/, skills/, team_chat/
│   └── settings.json
├── cloudflared.exe          # Cloudflare Tunnel binary (deployment)
└── README.md (this file)
```

## Quick Start

```bash
cd ticket-system
cp .env.example .env.local        # fill in real values
npm install
npx prisma generate
npm run dev                       # http://localhost:3000
```

ดู [ticket-system/README.md](ticket-system/README.md) สำหรับรายละเอียดการพัฒนา

## Governance

โปรเจกต์นี้ใช้ **RoundTable Framework** — ระบบ AI หลายทีมที่กำหนดมาตรฐาน plan-before-code, ticket-driven workflow, และ audit logging ทั้งหมด ดู [.claude/CLAUDE.md](.claude/CLAUDE.md) และ [.claude/policies/](.claude/policies/) สำหรับนโยบายฉบับเต็ม

ทุก feature/bug fix ต้องมี ticket ใน `Development/Web_repair_center/` ก่อนแตะโค้ด

## Status

**Project mode:** Centralized · **Active phase:** Phase 0 — Foundation Reset (post-RoundTable install) · **Last reviewed:** 09-05-2026

ดู `Development/Web_repair_center/PreExisting TechStack/Web_repair_center.md` สำหรับ scan ฉบับเต็มของ codebase ที่มีอยู่
