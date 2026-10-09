# HAYAN REAL ESTATE Project Audit

**Date:** 2026-10-09  
**Branch:** `audit/phase-1-baseline` (created from `master`)  
**Scope:** Local source review and non-destructive checks. No database writes, migrations, deployment, or push were performed.

## Executive summary

The existing Expo/React Native and Expo Router application is a pnpm monorepo. The mobile artifact serves web/PWA output and uses Supabase directly for application data, auth, storage, RLS, and realtime. The separate Express API currently exposes a health route; it is not the main data API. This audit preserves that architecture.

The earlier branch fixes remain present. This follow-up corrected the web map to render each geolocated property with a clickable marker and prepared two local-only database hardening migrations after reviewing the security-definer chat RPC and viewing trigger. None of the new migrations has been applied. End-to-end marketplace and adversarial RLS workflows remain untested.

## Architecture and feature status

| Area | Status | Evidence / notes |
|---|---|---|
| Workspace and app architecture | PASS (source inspected) | pnpm workspace; Expo, React Native, Expo Router, TypeScript; separate API and scripts packages. |
| Web/PWA and native targets | PARTIAL | Expo static web export and PWA shell/manifest/service worker are present; native app configuration exists. Offline data is not cached as a marketplace dataset. Web map now uses Leaflet with OpenStreetMap tiles and one marker per geolocated result; browser visual QA was unavailable. |
| Authentication and account approval | PARTIAL | Supabase Auth, profile context, password recovery, MFA and admin approval flows are implemented. End-to-end sign-in/signup/recovery was not exercised against a test account. Missing profile now fails closed in the client. |
| Roles and admin authorization | PARTIAL | Admin role checks and database policies/migrations exist; no adversarial RLS integration test was run. |
| Property creation/editing/images | PARTIAL | Existing listing forms and image upload flows found. Upload limits and full platform behavior were not end-to-end tested. |
| Discovery, search and filters | PARTIAL | Client-side filters cover query, city, price, category, listing type, beds/baths, pets and parking. Active results now exclude non-available listings. Sorting, pagination and large-catalog query behavior remain incomplete/unverified. |
| Property details and saved listings | PARTIAL | Detail, bookmark and saved-search/collection flows exist; no live account flow test was run. Direct detail access can still show unavailable property status. |
| Viewings and appointments | PARTIAL | Booking and admin state transitions and overlap protections exist in migrations. A local migration now makes new appointments reject unapproved or unavailable listings; it is not applied and no live workflow test was run. |
| Messaging and realtime | PARTIAL | Participant-restricted conversations/messages and realtime code exist. A local migration now requires approved/MFA-satisfied senders and removes direct member insertion; it is not applied and no two-account authorization test was run. Conversation creation is still keyed around participant pairs, which may combine separate property discussions. |
| In-app alerts and push | PARTIAL | In-app alert flows exist. Remote `supabase functions list` returned only `delete-account` as ACTIVE; `send-alert-push` is local only. The Expo Push delivery path, webhook secret and database webhook are not configured/verified end to end. |
| Admin moderation/settings | PARTIAL | Account/listing moderation, viewing/report/verification and branding settings are present. Featured-listing controls and richer analytics were not found. |
| Database/RLS/storage | PARTIAL | Source migrations restrict admin/profile/property/viewing/chat access and storage object paths. Two new local hardening migrations are pending. Remote migration history matched the 22 previously applied migrations; no live policy test was run. Listing images are intentionally public and path-scoped for upload/delete; server-side MIME/size restrictions were not confirmed. |
| Tests and CI | NOT TESTED | No test suite or lint script was found in the workspace scripts inspected. TypeScript workspace check is available and was run. |
| Deployment and secrets | NOT TESTED | No deployment or production environment configuration was changed or validated. |

## Confirmed findings and changes

### Account approval fallback

- **File:** `artifacts/mobile/contexts/AuthContext.tsx`
- **Finding:** `loadSupabaseUser` used `profile?.approval_status ?? "approved"`. A missing profile row could therefore produce a client user marked approved.
- **Change:** Missing profiles and absent/invalid approval values now return an explicit error. The app no longer converts missing approval data to approved.
- **Compatibility:** Migration `20261008000001_admin_account_approval.sql` adds `approval_status` with default `approved` for existing rows, while its signup trigger inserts new profiles as `pending`. The change does not alter database rows or legitimate existing approval statuses.

### Listing availability in active results

- **Files:** `artifacts/mobile/contexts/ListingsContext.tsx`, `artifacts/mobile/lib/recommendations.ts`
- **Finding:** Discovery filtered listing moderation status but did not filter availability; recommendations used the same omission.
- **Change:** Active discovery and recommendations now include only approved (or legacy status-less) and available (or legacy availability-less) properties. Owner/admin views and direct detail routes retain their existing behavior.

## Other confirmed gaps and follow-up

- Web map rendering was previously found to represent only one point in its embedded map while listing all properties in the accompanying list. A multi-marker map implementation needs a scoped UI change and visual verification.
- Search currently filters the client-loaded property set; server-side pagination/sorting should be considered as listing volume grows.
- Push delivery depends on Edge Function deployment and provider credentials; neither was changed or claimed as working.
- No evidence was established for backup/restore drills, production observability, rate limiting, or end-to-end tests.
- Image bucket upload size/dimension limits and private evidence document storage need focused review before collecting identity documents.

## Follow-up review and local changes (2026-10-09)

### Web map

- **File:** `artifacts/mobile/app/map-search.web.tsx`
- **Finding:** OpenStreetMap's embed URL accepted one `marker` parameter, so only the first coordinate appeared as a map pin even though every result appeared in the list.
- **Change:** Replaced the single-marker iframe with Leaflet. Every result with valid coordinates gets a clickable HAYAN marker; multiple markers fit the map bounds. Native `map-search.tsx` remains unchanged.
- **Verification:** Typecheck and static PWA export passed and bundled the Leaflet chunk/CSS. Browser visual testing was **NOT TESTED** because no browser instance was available. Metro warned that Leaflet CSS references local default marker/layer image files; the implementation uses inline `DivIcon` markers and does not use the default marker/layer icon assets.

### Chat RPC / conversation membership

- **Finding:** `get_or_create_direct_conversation` is `SECURITY DEFINER`, inserts memberships while bypassing RLS, and did not check approval/MFA. A permissive creator policy also let a client add extra members after thread creation.
- **Local migration:** `20261009000001_harden_direct_conversations.sql` checks approved account and MFA state for the caller, requires an approved/non-suspended recipient, validates an optional listing belongs to that recipient, and removes client-side membership insertion (thread creation continues through the RPC).
- **Verification:** Reviewed against `ChatContext.tsx` (the app creates threads through the RPC). Migration is **NOT TESTED** against PostgreSQL and **NOT APPLIED** remotely. Existing membership and old thread rows are not modified by this migration.

### Viewing creation

- **Finding:** The `SECURITY DEFINER` viewing trigger assigned the listing owner but checked only that the property existed. A caller with a known ID could request a viewing on pending/rejected or unavailable listings.
- **Local migration:** `20261009000002_validate_viewing_property.sql` makes the trigger require `status='approved'` and `availability_status='available'` on insert; it preserves existing participant and status-transition rules.
- **Verification:** Migration is **NOT TESTED** against PostgreSQL and **NOT APPLIED** remotely. It does not rewrite existing appointments.

### Security review (source review, not database test)

- **Admin self-promotion:** Source review found `admin_users` has only a self-row SELECT policy, no user INSERT/UPDATE/DELETE policy. Profile privilege trigger rejects user changes to role, suspension, verification and approval fields. Admin authorization derives from an active `admin_users` row. **PASS (code-reviewed); BLOCKED (live RLS test).**
- **Other users' properties:** Property owner RLS scopes writes to `owner_id=auth.uid()`; the trigger blocks owner/id changes and client edits to status/featured/views. **PASS (code-reviewed); BLOCKED (live RLS test).**
- **Messages:** Message read/send policies require conversation membership, and read receipts are protected by a trigger. The local chat migration closes extra membership insertion and adds RPC approval/MFA checks. **PASS (code-reviewed current migration set); BLOCKED (migration execution and two-user RLS test).**
- **Appointments:** Select/update policies scope access to requester, listing owner/agent, or admin; trigger protects participant identity and valid status transitions. The local viewing migration closes the hidden/unavailable listing creation gap. **PASS (code-reviewed current migration set); BLOCKED (migration execution and two-user RLS test).**
- **Storage:** Public read is intentional for listing images; authenticated upload/delete paths must start with the caller's user ID. Client-side image MIME checks are not a server-side policy. Actual remote bucket MIME/size settings were **NOT TESTED**.
- **Runtime environment:** Local Supabase status/test was **BLOCKED** because Docker and Podman are unavailable. No production writes or migrations were attempted.

### Search, workflows, and push

- Search still fetches the shared property collection and filters client-side. Server pagination would make detail, owner-profile, bookmark, and other screens operate on a partial collection; adding it safely requires a route-level data-loading design. No sort UI or convention exists, and client sorting would not reduce query cost. Pagination/sorting were therefore **NOT IMPLEMENTED** in this pass.
- Registration/approval, login/logout/session restore, listing CRUD/images, search/bookmarks/saved searches, viewings, messaging, and admin moderation were code-reviewed but not exercised end to end. They require test identities and database mutations; no safe local Supabase stack is available. See final status report for workflow results.
- Push delivery is **NOT TESTED**. The remote function list confirmed only `delete-account` is active. `send-alert-push` requires `DALKA_PUSH_WEBHOOK_SECRET`, service-role function secrets and a configured database webhook. Expo's web push-token listener warning remains.

## Baseline and verification

- Initial Git branch: `master`; HEAD before work: `5aef6909` (`Add admin-managed PWA app icon`).
- Pre-existing local modification preserved: `artifacts/mobile/components/BrandLockup.tsx` (not part of this follow-up).
- Pre-existing untracked files preserved: `api-errors.txt`, `mobile-errors.txt`, `mockup-errors.txt`.
- Baseline `pnpm typecheck`: **PASS** (completed before implementation).
- Post-change `pnpm typecheck`: **PASS** across mobile, API server, scripts and mockup sandbox.
- Post-change `pnpm --filter @workspace/mobile build:pwa`: **PASS**; Expo exported 36 static routes and added the manifest and service worker to `dist/`. Expo emitted its existing notice that push token change listeners are not supported on web.
- Follow-up `pnpm typecheck`: **PASS**.
- Follow-up `pnpm --filter @workspace/mobile build:pwa`: **PASS**; Expo exported 36 routes and bundled Leaflet. Metro emitted local-CSS-resource warnings for unused Leaflet default layer/marker icon images and the existing web push listener warning.
- `git diff --check`: **PASS**. No unit/integration test command is configured. Visual map inspection was **NOT TESTED**; browser service returned no available browser instances.
- Supabase remote migration/function listings were read-only. They showed 22 previously applied migrations and only `delete-account` active. The two `20261009` migrations are local and pending. No production data, schema, auth users, storage objects, or deployment state was modified.
