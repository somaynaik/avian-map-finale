// @ts-nocheck
// Deploy as a Supabase Edge Function, then invoke it from a scheduled job or webhook.
// Required secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SMTP_USER (your gmail address)
// - SMTP_PASS (your gmail app password)
// - EMAIL_FROM (optional, defaults to SMTP_USER)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const smtpUser = Deno.env.get("SMTP_USER") ?? "";
const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
const emailFrom = Deno.env.get("EMAIL_FROM") ?? smtpUser;

const supabase = createClient(supabaseUrl, serviceRoleKey);

type ProfileRow = {
  id: string;
  username: string;
  full_name: string | null;
};

Deno.serve(async () => {
  if (!supabaseUrl || !serviceRoleKey || !smtpUser || !smtpPass) {
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

  if (!jobs || jobs.length === 0) {
    return Response.json({ processed: 0 });
  }

  // Initialize SMTP client for Gmail using denomailer
  const smtpClient = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: smtpUser,
        password: smtpPass,
      },
    },
  });

  for (const job of jobs) {
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
          <p><strong>${actorName}</strong> just followed you on Avian Map.</p>
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
          <p>You have received a new direct message from <strong>${actorName}</strong> on Avian Map.</p>
          <p style="padding: 12px; background: #f4f4f5; border-radius: 8px; font-style: italic; color: #3f3f46;">
            "${snippet}"
          </p>
          <p>Open the app to reply.</p>
        </div>
      `;
    } else {
      continue;
    }

    try {
      // Optimistically claim the job by updating processed_at where it is still null
      const { data: claimed, error: claimError } = await supabase
        .from("email_notifications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", job.id)
        .is("processed_at", null)
        .select();

      if (claimError || !claimed || claimed.length === 0) {
        // Already claimed or processed by another concurrent invocation
        console.log(`Job ${job.id} already claimed or processed, skipping.`);
        continue;
      }

      await smtpClient.send({
        from: emailFrom,
        to: recipientAuth.data.user.email,
        subject,
        html,
      });
    } catch (error: any) {
      console.error(`Failed to send email for job ${job.id}:`, error);
      // Revert the processed_at update on failure so it can be retried
      await supabase
        .from("email_notifications")
        .update({ processed_at: null })
        .eq("id", job.id);
    }
  }

  await smtpClient.close();

  return Response.json({ processed: jobs.length });
});
