NexAI — Maternal Health Risk Management Platform
> A clinical web application built to reduce maternal mortality in India by digitizing high-risk pregnancy tracking, automating risk detection, and closing the referral follow-up gap in government hospitals.
---
The Problem
India records 97 maternal deaths per 100,000 live births. Conditions like preeclampsia, gestational diabetes, and severe anaemia develop silently between monthly hospital visits. In government hospitals, all tracking is done on paper registers — no alerts, no trend analysis, and no follow-up when a patient is referred to a higher centre.
The referral gap is the most critical failure: when a doctor refers a high-risk patient to another hospital, they never find out if she arrived, was admitted, or delivered safely.
---
What NexAI Does
NexAI replaces the paper High Risk Pregnancy (HRP) register with a smart digital platform that:
Registers patients and auto-calculates EDD from LMP
Tracks vitals per visit (BP, Hb, weight)
Detects risk automatically using multi-factor clinical rules
Manages referrals and tracks whether patients actually arrive
Shows doctors a full patient timeline after referral
Alerts doctors to delayed referrals and overdue follow-ups
---
Features
Patient Management
Register patients with auto-generated `NX-000001` patient codes
Auto-calculate Expected Delivery Date (EDD) from Last Menstrual Period (LMP)
Detect and prevent duplicate registrations by phone number
Delete with 10-second undo
Multi-Factor Risk Detection
Risk is calculated dynamically (not stored) using clinical rules:
BP systolic > 140 or diastolic > 90
Hb < 10 g/dL (anaemia)
Age < 18 or > 35
Gravida ≥ 3 (high parity)
Each risk flag shows an explanation — not just a label.
Visit Tracking
Record BP, Hb, weight, and clinical notes per visit
Live risk preview while entering BP
Doctor verification system (mark visit as verified with doctor's name)
Referral Tracking (core feature)
Refer patient to any hospital with reason and priority (HIGH / MEDIUM / LOW)
Priority auto-set based on risk assessment
Track referral status: PENDING → ARRIVED / NOT ARRIVED
Delayed referral detection (>2 days pending) with dashboard alerts
Patient Timeline
Full post-referral journey tracking:
Reached Hospital, Admitted, Delivery (Normal / C-Section / Complication), Discharged
Follow-up Call, Follow-up Visit
Chronological timeline view on patient detail page
Dashboard
High risk patients with risk reasons expanded
Delayed referrals with inline status update buttons
High priority referrals
Unverified visits (last 7 days)
Due soon patients (EDD within 14 days)
Overdue follow-up tracking
---
Tech Stack
Layer	Technology
Frontend	React.js (mobile-first, no UI library)
Backend	Node.js + Express
Database	PostgreSQL
Hosting	Render (backend) + Vercel (frontend)
Styling	Pure CSS with CSS variables
---
Database Schema
```
patients          — core patient records + follow-up date
visits            — per-visit vitals + verification
referrals         — referral destination, status, priority
timeline_events   — post-referral journey events
```
---
API Endpoints
Method	Endpoint	Description
POST	`/patients`	Register patient (duplicate phone check)
GET	`/patients?search=`	Search by name, phone, or patient code
DELETE	`/patients/:id`	Delete patient
POST	`/patients/restore`	Restore deleted patient
PATCH	`/patients/:id/followup`	Set next follow-up date
POST	`/visits`	Record visit with risk calculation
GET	`/visits/:patient_id`	Get visit history
PATCH	`/visits/:id/verify`	Mark visit as doctor-verified
POST	`/referrals`	Create referral with priority
GET	`/referrals/:patient_id`	Get referral history
PATCH	`/referrals/:id/status`	Update referral status
POST	`/timeline`	Add timeline event
GET	`/timeline/:patient_id`	Get patient timeline
GET	`/dashboard/stats`	Summary stats
GET	`/dashboard/high-risk`	High risk patients with reasons
GET	`/dashboard/delayed-referrals`	Referrals pending > 2 days
GET	`/dashboard/high-priority`	High priority pending referrals
GET	`/dashboard/unverified-visits`	Visits needing verification
GET	`/dashboard/due-soon`	Patients delivering in 14 days
GET	`/dashboard/followups`	Overdue and upcoming follow-ups
---
Setup
Prerequisites
Node.js 18+
PostgreSQL 14+
Backend
```bash
cd NexAI/backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
node server.js
```
Database
```bash
psql -U postgres -d nexai -f schema.sql
psql -U postgres -d nexai -f referral_schema.sql
psql -U postgres -d nexai -f migration_v5.sql
psql -U postgres -d nexai -f timeline_migration.sql
```
Frontend
```bash
cd NexAI/frontend
npm install
# Create .env with:
# REACT_APP_API_URL=http://localhost:5000
npm start
```
Environment Variables
Backend `.env`
```
DATABASE_URL=postgresql://username:password@localhost:5432/nexai
PORT=5000
```
Frontend `.env`
```
REACT_APP_API_URL=https://your-backend.onrender.com
```
---
Deployment
Backend: Render (free tier) — set `DATABASE_URL` in environment variables
Frontend: Vercel — set `REACT_APP_API_URL` to your Render backend URL
Database: Render PostgreSQL or Supabase
---
Clinical Validation
This project was built with guidance from a practicing medical intern. The risk detection rules are based on standard antenatal care protocols used in Indian government hospitals (PMSMA guidelines). The feature set was validated against real clinical workflow pain points including the referral tracking gap and HRP register digitization.
---
What I Learned
Clinical workflow design is fundamentally different from consumer UX — speed and reliability matter more than aesthetics
The biggest gap in Indian maternal healthcare is not detection — it is continuity between visits and referral follow-up
Mobile-first design for low-end Android devices requires strict constraint: no heavy libraries, minimal JS, large tap targets
Building for healthcare taught me to think about edge cases that matter — a bug here isn't an inconvenience, it's a clinical risk
---
Status
This project is paused. The MVP is deployed and functional. It was built as an independent project to understand how software can address real public health problems in India.
---
Author
Mukesh K A — Student Developer  
Built independently as a research and product exploration project in 2026.
