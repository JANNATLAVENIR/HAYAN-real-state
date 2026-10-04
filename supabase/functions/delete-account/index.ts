import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getAuthTime(accessToken: string): number | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64)) as { auth_time?: unknown };
    return typeof claims.auth_time === "number" ? claims.auth_time : null;
  } catch {
    return null;
  }
}

async function listUserObjects(admin: ReturnType<typeof createClient>, userId: string): Promise<string[]> {
  const paths: string[] = [];
  const folders = [userId];
  while (folders.length) {
    const folder = folders.pop()!;
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from("property-images").list(folder, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`STORAGE_LIST_FAILED: ${error.message}`);
      const entries = data ?? [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) folders.push(path);
        else paths.push(path);
      }
      if (paths.length > 100_000) throw new Error("STORAGE_OBJECT_LIMIT_EXCEEDED");
      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }
  return paths;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!authorization || !accessToken) return json(401, { error: "AUTHENTICATION_REQUIRED" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  if (!payload || typeof payload !== "object" || (payload as { confirmation?: unknown }).confirmation !== "DELETE") {
    return json(400, { error: "CONFIRMATION_REQUIRED" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: "DELETION_SERVICE_NOT_CONFIGURED" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json(401, { error: "AUTHENTICATION_REQUIRED" });

  const authTime = getAuthTime(accessToken);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTime || authTime > nowSeconds + 60 || nowSeconds - authTime > 10 * 60) {
    return json(401, { error: "RECENT_SIGN_IN_REQUIRED" });
  }

  const { data: assurance, error: assuranceError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) return json(401, { error: "MFA_CHECK_FAILED" });
  const { data: factors, error: factorsError } = await userClient.auth.mfa.listFactors();
  if (factorsError) return json(401, { error: "MFA_CHECK_FAILED" });
  if (factors.totp.some((factor) => factor.status === "verified") && assurance.currentLevel !== "aal2") {
    return json(403, { error: "MFA_VERIFICATION_REQUIRED" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { count: activeAdminCount, error: adminCountError } = await admin
    .from("admin_users")
    .select("user_id", { count: "exact", head: true })
    .eq("is_active", true);
  if (adminCountError) return json(500, { error: "ADMIN_CHECK_FAILED" });
  const { data: activeAdmin, error: activeAdminError } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (activeAdminError) return json(500, { error: "ADMIN_CHECK_FAILED" });
  if (activeAdmin && (activeAdminCount ?? 0) <= 1) return json(409, { error: "LAST_ACTIVE_ADMIN" });

  const { data: existingJob, error: jobReadError } = await admin
    .from("account_deletion_jobs")
    .select("id,status,updated_at")
    .eq("user_id", userData.user.id)
    .in("status", ["processing", "failed"])
    .maybeSingle();
  if (jobReadError) return json(500, { error: "DELETION_JOB_LOOKUP_FAILED" });
  if (existingJob?.status === "processing" && Date.now() - Date.parse(existingJob.updated_at) < 5 * 60 * 1000) {
    return json(409, { error: "DELETION_ALREADY_PROCESSING" });
  }

  let jobId = existingJob?.id as string | undefined;
  if (jobId) {
    const { error } = await admin.from("account_deletion_jobs").update({ status: "processing", error_code: null, updated_at: new Date().toISOString() }).eq("id", jobId);
    if (error) return json(500, { error: "DELETION_JOB_UPDATE_FAILED" });
  } else {
    const { data: job, error } = await admin.from("account_deletion_jobs").insert({ user_id: userData.user.id, status: "processing" }).select("id").single();
    if (error || !job) return json(409, { error: error?.code === "23505" ? "DELETION_ALREADY_PROCESSING" : "DELETION_JOB_CREATE_FAILED" });
    jobId = job.id;
  }

  try {
    // The app uploads profile and listing photos under property-images/{userId}.
    // Inventory first, then remove through Storage API before deleting Auth.
    const objectPaths = await listUserObjects(admin, userData.user.id);
    for (let start = 0; start < objectPaths.length; start += 100) {
      const { error } = await admin.storage.from("property-images").remove(objectPaths.slice(start, start + 100));
      if (error) throw new Error(`STORAGE_REMOVE_FAILED: ${error.message}`);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
    if (deleteError) throw new Error(`AUTH_DELETE_FAILED: ${deleteError.message}`);

    const { error: completeError } = await admin.from("account_deletion_jobs").update({
      status: "completed",
      error_code: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    if (completeError) return json(202, { status: "deleted", auditStatus: "completion_update_pending" });
    return json(200, { status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DELETION_FAILED";
    const errorCode = message.split(":", 1)[0].slice(0, 80);
    await admin.from("account_deletion_jobs").update({ status: "failed", error_code: errorCode, updated_at: new Date().toISOString() }).eq("id", jobId);
    return json(500, { error: errorCode, message: "Deletion did not finish. Sign in and retry or contact HAYÁN support." });
  }
});
