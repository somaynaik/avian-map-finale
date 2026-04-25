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
    .in("type", ["new_follower", "new_message"])
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

    let subject = "";
    let html = "";

    if (job.type === "new_follower") {
      subject = "You have a new follower";
      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>You have a new follower</h2>
          <p><strong>${actorName}</strong> just followed you on Feather Finder.</p>
          <p>Open the app to view their profile or send them a message.</p>
        </div>
      `;
    } else if (job.type === "new_message") {
      subject = `New message from ${actorName}`;
      const msgBody = typeof job.payload.body === 'string' ? job.payload.body : '';
      const snippet = msgBody.length > 200 ? msgBody.substring(0, 200) + '...' : msgBody;
      html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>New message from ${actorName}</h2>
          <p>You have received a new direct message from <strong>${actorName}</strong> on Feather Finder.</p>
          <p style="padding: 12px; background: #f4f4f5; border-radius: 8px; font-style: italic; color: #3f3f46;">
            "${snippet}"
          </p>
          <p>Open the app to reply.</p>
        </div>
      `;
    } else {
      continue;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [recipientAuth.data.user.email],
        subject,
        html,
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
