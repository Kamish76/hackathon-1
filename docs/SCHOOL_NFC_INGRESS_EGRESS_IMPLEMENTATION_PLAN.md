# School-wide NFC Ingress/Egress Web System

**Version:** v0.2 (Living Plan)  
**Last Updated:** 2026-02-27

## 1) Goal
Build a web-based system to track **IN/OUT** movement for:
- Students
- Staff
- Visitors
- Special Guests

Operator roles:
- Admin
- Taker

---

## 2) MVP Scope (Phase 1)
1. Person registry for all person types
2. NFC credential binding
3. Gate scan page for Takers
4. IN/OUT event logging
5. Basic anti-passback rules
6. Manual override with mandatory reason
7. Live “currently inside” dashboard
8. Daily attendance and visitor reports

---

## 3) Core Workflows
### 3.1 Walk-in Scan
- NFC tap reads credential
- Resolve person identity and role
- Infer or confirm direction (IN/OUT)
- Persist immutable access event

### 3.2 Vehicle Entry/Exit
- Create `vehicle_session` on entry
- Link each passenger scan to session
- Support mixed occupants (students + visitors + staff)
- Reconcile and close session on exit

### 3.3 Visitor and Special Guest
- Register visitor/guest + host/sponsor
- Issue temporary credential with expiry
- Alert when expired credential remains inside

### 3.4 Exception Handling
- Invalid card / duplicate tap / no card
- Taker uses manual override
- Capture reason and operator in audit log

---

## 4) Why NFC Is the Best Credential Technology for This Use Case

NFC (Near Field Communication) tags are the ideal physical credential for a school ingress/egress system for the following reasons:

### Cost
- NFC tags are inexpensive — typically **under $1 USD per tag** when purchased in bulk.
- The low per-unit cost makes it feasible to issue credentials to every student, staff member, and visitor without a significant budget impact.
- Replacement credentials are affordable enough that lost or damaged tags are a minor operational cost, not a major incident.

### Size and Form Factor
- NFC tags are **extremely small** — they can be embedded inside a standard ID card, key fob, wristband, or sticker.
- Their compact size means they can be worn or carried without inconvenience, and they integrate naturally into existing school ID card programs.

### Weight
- NFC tags are **virtually weightless**, adding no meaningful burden for students or staff who carry them all day.
- This makes compliance much easier compared to heavier hardware tokens or dedicated reader devices.

### Easy to Buy and Replace
- NFC tags are **widely available** from consumer electronics retailers and online marketplaces worldwide.
- When a credential is lost, stolen, or damaged, the school can purchase and provision a replacement tag immediately — no specialized vendor or lengthy procurement process required.
- The two-phase write flow in this system (prepare → write → confirm) is designed specifically to make tag replacement safe and auditable.

### Summary

| Factor | NFC Tag | Printed QR Card | Barcode Card | Biometric |
|---|---|---|---|---|
| Cost per credential | < $1 | ~$0.10 (reprint required) | ~$0.10 (reprint required) | High |
| Tap speed | < 1 second | Requires camera scan | Requires scanner | Slow |
| Durability | High | Low (fades/tears) | Medium | N/A |
| User replacement ease | Buy anywhere | Reprint only | Reprint only | N/A |
| Privacy (no visible ID) | ✅ | ❌ | ❌ | ⚠️ High privacy risk |

NFC offers the best overall balance of cost, speed, durability, and user convenience for a school gate access system.

---

## 5) Technical Direction
- **Frontend:** Web app (dashboard + gate scan UI)
- **NFC Input:** Web NFC API (supported browsers/devices)
- **Backend:** API + relational database with immutable event history
- **Authorization:** RBAC for Admin and Taker
- **Auditability:** Store actor, action, timestamp, and reason for edits/overrides

> Note: Web NFC support is currently limited (primarily Chromium on Android). Include fallback paths early (manual entry, QR, or external reader integration).

---

## 6) Minimum Data Model
- `persons`
- `credentials`
- `gates`
- `access_events`
- `vehicle_sessions`
- `vehicle_passengers`
- `manifests` (optional in MVP, recommended in next phase)
- `override_logs`
- `users` (admins/takers)

---

## 7) Non-Functional Requirements
- Offline-capable scan queue + background sync
- Idempotent sync to prevent duplicate events
- Clock/timezone consistency across gate devices
- Fast gate response (target: <2 seconds per scan)
- Privacy and access control for student and visitor data

---

## 8) Rollout Phases
### Sprint 1
- Core entities, auth, role permissions
- Person and credential management

### Sprint 2
- Gate scan UI
- Access event creation
- Anti-passback baseline rules

### Sprint 3
- Vehicle session flow
- Initial analytics/reporting

### Sprint 4
- Offline mode + sync hardening
- Pilot deployment to one gate

### Sprint 5
- Pilot review and incident tuning
- School-wide rollout preparation

---

## 9) Open Questions (to review weekly)
1. Is passenger-level scanning mandatory for all vehicles?
2. Are manifests required for school buses/service vehicles?
3. What exact devices will Takers use at each gate?
4. What is the policy for forgotten/lost credentials?
5. What is the correction flow for wrong IN/OUT logs?
6. Which compliance/privacy constraints apply to data retention?

---

## 10) Success Metrics
- Scan success rate
- Duplicate/invalid scan rate
- Average gate processing time
- Unresolved exception count
- Accuracy of “currently inside” occupancy list

---

## 11) Change Log
- **v0.1 (2026-02-26):** Initial draft created as a living implementation plan.
- **v0.2 (2026-02-27):** Added NFC technology rationale (section 4).

---

## 12) Next Revision Notes (Fill as You Go)
- Decisions made this week:
- Risks identified:
- Scope changes approved:
- Items deferred:
