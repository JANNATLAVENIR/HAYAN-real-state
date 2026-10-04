# HAYÁN Real Estate - Luxury Property Marketplace

## Overview

HAYÁN is a premium real estate mobile app built with React Native (Expo) featuring a "Dior Vibe" luxury aesthetic with cream, charcoal, and soft gold color palette.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React Native (Expo) with expo-router
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (ready for backend expansion)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Local Storage**: AsyncStorage (client-side persistence)

## App Architecture

### Screens
- **Auth**: Supabase Login, Register, Forgot Password
- **Tabs**: Discovery Feed, Chat, Alerts/Notifications, Profile
- **Stack**: Property Detail, Create Listing, Schedule Viewing, Edit Profile, Change Password, Conversation

### Features
- Supabase-managed authentication and password reset flows
- Role-based profiles (Buyer, Seller, Renter, Agent)
- Luxury property discovery feed with advanced filtering
- In-app real-time messaging
- Notification center for price drops, new listings, viewings
- Multi-step listing creation flow
- Property viewing scheduling with calendar
- Profile management with bookmarks and saved searches
- Seller/Agent dashboard with listing views tracking

### Design System (Dior Vibe)
- **Background**: #FAF8F5 (warm cream)
- **Foreground**: #2C2C2C (charcoal)
- **Primary**: #C9A96E (soft gold)
- **Card**: #FFFFFF
- **Typography**: Inter (400/500/600/700) with elegant letter spacing
- **Design principles**: Minimalist, luxury, generous whitespace, uppercase labels

### Key Files
- `artifacts/mobile/constants/colors.ts` - Theme colors
- `artifacts/mobile/constants/types.ts` - TypeScript interfaces
- `artifacts/mobile/constants/seed.ts` - Demo data
- `artifacts/mobile/contexts/` - Auth, Listings, Chat, Alerts providers
- `artifacts/mobile/components/` - PropertyCard, FilterSheet, ChatBubble, StepIndicator

## Mobile release setup

- Copy `artifacts/mobile/.env.example` to `artifacts/mobile/.env` and set the Supabase project URL and anon key. Do not put a Supabase service-role key in the app.
- Apply the SQL files to the Supabase project in dependency order: `schema.sql`, `viewings-scheduling-hardening.sql`, `admin.sql`, `admin-management.sql`, `admin-actions.sql`, `local-market-units.sql`, `admin-policies.sql`, `chat-policies.sql`, `chat-direct-threads.sql`, `storage-policies.sql`, `realtime.sql`, `location.sql`, `production-hardening.sql`, `alert-triggers.sql`, `profile-follows.sql`, `saved-searches.sql`, `property-reviews.sql`, `roadmap-completion.sql`, then `roadmap-workflows.sql`.
- `chat-direct-threads.sql` merges duplicate one-to-one conversations while preserving messages, and adds the atomic RPC used to open a persistent direct thread per user pair.
- `profile-follows.sql` adds seller/agent follows, follower statistics and alerts for followed listings that are approved or reduced in price.
- `saved-searches.sql` enables per-user saved filter sets used by the mobile app. `property-reviews.sql` enables one public rating and review per signed-in user per property.
- `production-hardening.sql` is a one-time migration. It limits profile reads, prevents self-assigned privileged roles and listing approvals, validates viewing updates, and adds the listing view counter RPC.
- Promote only the intended owner account to admin. `promote-owner.sql` contains a preselected email; verify or replace it before running, or insert the intended Auth user UUID into `admin_users` manually.
- Build with `eas build --profile preview --platform all` for internal installs or `eas build --profile production --platform all` for store builds. Submit only after setting up the EAS project and Apple/Google developer credentials.
- The identifiers in `artifacts/mobile/app.json` are defaults. Confirm `com.dalka.mobile` is available and change both platform identifiers if it is already claimed.
- Set a restricted `GOOGLE_MAPS_API_KEY` in the EAS build environment for Android map tiles; `artifacts/mobile/app.config.js` injects it into the native config without committing the secret.
- Before store submission, provide a hosted privacy policy and support contact, complete Apple App Privacy and Google Play Data safety declarations, and add a restricted Google Maps API key if map tiles are required on Android.

2FA and biometric sign-in are not presented as available features until their complete enrollment and verification flows are implemented.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
