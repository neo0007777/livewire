import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
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
  const at = new AccessToken(Deno.env.get("LIVEKIT_API_KEY")!, Deno.env.get("LIVEKIT_API_SECRET")!, {
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

  return json({ token: await at.toJwt(), url: Deno.env.get("LIVEKIT_URL"), role: isCreator ? "creator" : "viewer" });
});

