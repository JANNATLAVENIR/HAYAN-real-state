# HAYÁN roadmap completion and deployment

## Database migration order

The ordered migrations now live in `supabase/migrations/` and are the source of truth for future schema changes. The original root-level SQL files are retained as references for projects that applied them manually. Do not apply those reference files again to a project whose schema already contains them.

For a linked project, run `pnpm run supabase:migrations` to inspect history and `pnpm run supabase:push` to apply pending migration files. Add all future schema changes as a new, timestamped file under `supabase/migrations/`.

The following root-level SQL files are a historical manual setup sequence for legacy projects created before migration tracking. They are not an alternative migration path and must not be replayed against a project managed by `supabase/migrations/`:

1. `schema.sql`
2. `viewings-scheduling-hardening.sql`
3. `admin.sql`, `admin-management.sql`, `admin-actions.sql`, `admin-policies.sql`
4. `chat-policies.sql`, `chat-direct-threads.sql`, `alert-triggers.sql`
5. `location.sql`, `local-market-units.sql`, `profile-follows.sql`, `property-reviews.sql`, `saved-searches.sql`
6. `realtime.sql`, `storage-policies.sql`, `production-hardening.sql`
7. `roadmap-completion.sql`
8. `roadmap-workflows.sql`

The roadmap migrations add user-owned property collections, agent reviews, Expo push-device registration, saved-search match alerts, and a restrictive MFA assurance policy. `roadmap-workflows.sql` adds seller/agent verification requests, listing reports, admin action history, public-contact consent, listing availability, and viewing rescheduling. The MFA policy only requires AAL2 for a user who has a verified MFA factor; public listing reads remain available.

Migration `20261004000020` prevents new one-hour viewing overlaps for the same owner/agent, including concurrent requests. It does not rewrite existing appointments. Migration `20261004000021` creates a service-role-only account-deletion job journal. The `delete-account` Edge Function requires a valid recent user session, a fresh password sign-in, and AAL2 when the account has verified MFA; it removes objects from `property-images/{user-id}` through the Storage API before deleting the Auth user. The existing foreign keys then cascade linked account data, including the user's owned listings. The app confirmation screen is `/delete-account`.

## Roadmap work now in the app

- Personalized listing suggestions use the user's saved homes and recent property views.
- Users can organize bookmarked homes into named collections.
- Agent profiles have public ratings and written reviews; the agent directory links to those profiles.
- Viewing requests can be added to the phone calendar.
- The app includes a local mortgage payment estimator, Face ID/Touch ID app lock, and Supabase TOTP MFA.
- Saved-search matches create in-app alerts. Once push is configured below, alerts can also reach registered devices.

The calculator is an estimate and the suggestions are local ranking logic; neither depends on a licensed financial or recommendation provider.

## Push notifications

Push on **both iOS and Android** requires a development or store build and an EAS project ID. Expo Go is not a supported target for remote push on current SDKs.

1. Link the app to the intended Expo account and run `eas init` from `artifacts/mobile`.
2. Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the project ID shown by Expo. The dynamic app config puts it in `extra.eas.projectId`.
3. The `development` EAS profile now builds a physical iPhone development client with `expo-dev-client`; start its build with `eas build --profile development --platform ios`.
4. For iOS, configure the Apple Push Notifications key in EAS; this needs Apple Developer credentials.
5. For Android, create a Firebase project, add the Android app with package `com.dalka.mobile`, add its `google-services.json` as `expo.android.googleServicesFile`, and upload an FCM V1 service-account key to EAS credentials. Keep the service-account private key out of source control.
6. Set the Supabase Edge Function secrets `DALKA_PUSH_WEBHOOK_SECRET` (a long random value), `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
7. Deploy `send-alert-push` with JWT verification disabled because the function authenticates the database webhook using the dedicated secret header:

   ```sh
   supabase functions deploy send-alert-push --no-verify-jwt
   ```

8. In Supabase Database Webhooks, create an `INSERT` webhook on `public.alerts` pointing to the deployed function. Add the header `x-dalka-webhook-secret` with the same secret. Never place the service role key in the app or webhook headers.

## Platform and store setup

- Android maps need a Google Maps Android API key. The dynamic config reads `GOOGLE_MAPS_API_KEY` and inserts it into the Android native config. Restrict that key to `com.dalka.mobile` and the relevant signing certificate fingerprints.
- iOS uses Apple's native map provider and does not use that Android Maps key.
- Before public iOS/Android release, prepare store listing assets and contact/support details, publish a privacy policy and terms, complete Apple App Privacy and Google Play Data safety disclosures, and provide an account-deletion path and required deletion URL. These business/legal details must reflect the actual operator and data practices.
- Deploy the account deletion handler with `supabase functions deploy delete-account --project-ref <project-ref>`. Once the web app is hosted on its public domain, enter its `/delete-account` route as the external deletion URL in Play Console and verify it can reach the signed-in deletion flow.
- Create the Apple App Store Connect and Google Play Console records, signing credentials, privacy disclosures, screenshots, and review notes. EAS builds alone do not publish either store listing.

## iPhone distribution

The EAS profiles now define internal iOS preview and store distribution. A TestFlight build still needs the owner's Expo/EAS project, Apple Developer Program membership, and App Store Connect credentials. Those account-specific identifiers cannot safely be invented in source code.

## Remaining vendor-backed roadmap items

MLS synchronization, school/transit/safety datasets, property video hosting, 3D/AR tours, and neighborhood market data need source contracts, API credentials, and—in some cases—licensed data. No vendor account or MLS feed was supplied, so the app does not fabricate these integrations. The current code supports normal photo listings, location pins, listing filters, owner profiles, and profile reviews/follows.
