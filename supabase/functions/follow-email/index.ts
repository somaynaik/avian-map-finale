// Deploy as a Supabase Edge Function, then invoke it from a scheduled job or webhook.
// Required secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - RESEND_API_KEY
// - EMAIL_FROM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const emailFrom = Deno.env.get("EMAIL_FROM") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

type ProfileRow = {
  id: string;
  username: string;
  full_name: string | null;
};

Deno.serve(async () => {
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return new Response("Missing required env vars", { status: 500 });
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("email_notifications")
    .select("id, recipient_user_id, actor_user_id, type, payload")
    .eq("type", "new_follower")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(25);

  if (jobsError) {
    return new Response(jobsError.message, { status: 500 });
  }

  for (const job of jobs ?? []) {
    const recipientAuth = await supabase.auth.admin.getUserById(job.recipient_user_id);
    if (recipientAuth.error || !recipientAuth.data.user?.email) {
      continue;
    }

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("id", job.actor_user_id)
      .single<ProfileRow>();

    const actorName =
      actorProfile?.full_name?.trim() || actorProfile?.username || "A birdwatcher";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [recipientAuth.data.user.email],
        subject: "You have a new follower",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>You have a new follower</h2>
            <p><strong>${actorName}</strong> just followed you on Feather Finder.</p>
            <p>Open the app to view their profile or send them a message.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const body = await resendResponse.text();
      return new Response(body, { status: 500 });
    }

    await supabase
      .from("email_notifications")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  return Response.json({ processed: jobs?.length ?? 0 });
});
