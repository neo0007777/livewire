import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  // Client acting AS the caller, so RLS applies
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  const { streamId } = await req.json().catch(() => ({}));
  if (!streamId) return json({ error: "stream_id_required" }, 400);

  const { data: stream } = await supabase
    .from("streams").select("id, creator_id, status, room_name").eq("id", streamId).single();
  if (!stream) return json({ error: "stream_not_found" }, 404);
  if (stream.status !== "live") return json({ error: "stream_not_live" }, 409);

  const isCreator = stream.creator_id === user.id;
  const livekitKey = Deno.env.get("LIVEKIT_API_KEY");
  const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const livekitUrl = Deno.env.get("LIVEKIT_URL") || "wss://placeholder.livekit.cloud";

  if (!livekitKey || !livekitSecret) {
    return json({
      token: "mock_token_" + stream.room_name,
      url: livekitUrl,
      role: isCreator ? "creator" : "viewer"
    });
  }

  const at = new AccessToken(livekitKey, livekitSecret, {
    identity: user.id,
    ttl: "2h",
  });
  at.addGrant({
    room: stream.room_name,
    roomJoin: true,
    canPublish: isCreator,
    canSubscribe: true,
    canPublishData: false,
  });

  return json({ token: await at.toJwt(), url: livekitUrl, role: isCreator ? "creator" : "viewer" });
});

