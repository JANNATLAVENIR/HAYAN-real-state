import { createClient } from "npm:@supabase/supabase-js@2";

type AlertRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  property_id: string | null;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("DALKA_PUSH_WEBHOOK_SECRET");
  if (!expected || request.headers.get("x-dalka-webhook-secret") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return new Response("Push service is not configured", { status: 500 });

  let alert: AlertRow;
  try {
    const payload = await request.json();
    alert = (payload.record ?? payload.new) as AlertRow;
    if (!alert?.id || !alert.user_id || !alert.title || !alert.body) throw new Error("Invalid alert row");
  } catch {
    return new Response("Invalid webhook payload", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: devices, error } = await admin
    .from("push_devices")
    .select("expo_push_token")
    .eq("user_id", alert.user_id);
  if (error) return new Response(error.message, { status: 500 });
  if (!devices?.length) return Response.json({ sent: 0 });

  const messages = devices.map(({ expo_push_token }) => ({
    to: expo_push_token,
    title: alert.title,
    body: alert.body,
    sound: "default",
    data: { alertId: alert.id, propertyId: alert.property_id },
    priority: "high",
    channelId: "default",
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) return new Response("Expo Push Service rejected the request", { status: 502 });
  return Response.json({ sent: messages.length });
});
