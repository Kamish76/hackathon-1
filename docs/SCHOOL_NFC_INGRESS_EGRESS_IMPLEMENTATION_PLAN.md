# School-wide NFC Ingress/Egress Web System

**Version:** v0.1 (Living Plan)  
**Last Updated:** 2026-02-26

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

## 4) Technical Direction
- **Frontend:** Web app (dashboard + gate scan UI)
- **NFC Input:** Web NFC API (supported browsers/devices)
- **Backend:** API + relational database with immutable event history
- **Authorization:** RBAC for Admin and Taker
- **Auditability:** Store actor, action, timestamp, and reason for edits/overrides

> Note: Web NFC support is currently limited (primarily Chromium on Android). Include fallback paths early (manual entry, QR, or external reader integration).

---

## 5) Minimum Data Model
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

## 6) Non-Functional Requirements
- Offline-capable scan queue + background sync
- Idempotent sync to prevent duplicate events
- Clock/timezone consistency across gate devices
- Fast gate response (target: <2 seconds per scan)
- Privacy and access control for student and visitor data

---

## 7) Rollout Phases
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

## 8) Open Questions (to review weekly)
1. Is passenger-level scanning mandatory for all vehicles?
2. Are manifests required for school buses/service vehicles?
3. What exact devices will Takers use at each gate?
4. What is the policy for forgotten/lost credentials?
5. What is the correction flow for wrong IN/OUT logs?
6. Which compliance/privacy constraints apply to data retention?

---

## 9) Success Metrics
- Scan success rate
- Duplicate/invalid scan rate
- Average gate processing time
- Unresolved exception count
- Accuracy of “currently inside” occupancy list

---

## 10) Change Log
- **v0.1 (2026-02-26):** Initial draft created as a living implementation plan.

---

## 11) Next Revision Notes (Fill as You Go)
- Decisions made this week:
- Risks identified:
- Scope changes approved:
- Items deferred:
