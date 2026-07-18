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
    let text = "";
    let html = "";

    if (job.type === "new_follower") {
      subject = `🐦 ${actorName} is now following you on Avian Map`;
      text = `Hello birdwatcher!\n\n${actorName} just started following you on Avian Map. Open the app to view their profile:\nhttps://avian-map.vercel.app\n\nHappy birding,\nThe Avian Map Team`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f4; padding: 32px 16px; margin: 0; min-height: 100%;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #15803d; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">Avian Map</h1>
            </div>
            <div style="padding: 32px 24px; color: #1c1917;">
              <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #1c1917;">You have a new follower!</h2>
              <p style="margin-bottom: 24px; font-size: 15px; line-height: 1.6; color: #44403c;">
                <strong>${actorName}</strong> just started following you on Avian Map. You can now message them, share coordinate sightings, or track mutual updates.
              </p>
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="https://avian-map.vercel.app" style="background-color: #15803d; color: #ffffff; padding: 12px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);">
                  View Profile
                </a>
              </div>
            </div>
            <div style="background-color: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #78716c; line-height: 1.5;">
                You received this notification because you are a registered user of Avian Map.<br>
                To opt-out of email alerts, update your preferences in the app profile settings.
              </p>
            </div>
          </div>
        </div>
      `;
    } else if (job.type === "new_message") {
      subject = `💬 New message from ${actorName} on Avian Map`;
      const msgBody = typeof job.payload.body === 'string' ? job.payload.body : '';
      const snippet = msgBody.length > 200 ? msgBody.substring(0, 200) + '...' : msgBody;
      text = `Hello birdwatcher!\n\nYou received a new message from ${actorName} on Avian Map:\n\n"${snippet}"\n\nOpen the app to reply:\nhttps://avian-map.vercel.app\n\nHappy birding,\nThe Avian Map Team`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f4; padding: 32px 16px; margin: 0; min-height: 100%;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #15803d; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">Avian Map</h1>
            </div>
            <div style="padding: 32px 24px; color: #1c1917;">
              <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #1c1917;">New message received</h2>
              <p style="margin-bottom: 20px; font-size: 15px; line-height: 1.6; color: #44403c;">
                <strong>${actorName}</strong> sent you a direct message:
              </p>
              <div style="background-color: #fafaf9; border-left: 4px solid #15803d; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 15px; line-height: 1.5; color: #1c1917; font-style: italic;">
                "${snippet}"
              </div>
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="https://avian-map.vercel.app" style="background-color: #15803d; color: #ffffff; padding: 12px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);">
                  Reply to ${actorName}
                </a>
              </div>
            </div>
            <div style="background-color: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #78716c; line-height: 1.5;">
                You received this notification because you are a registered user of Avian Map.<br>
                To opt-out of email alerts, update your preferences in the app profile settings.
              </p>
            </div>
          </div>
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
        text,
        html,
        headers: {
          "Precedence": "bulk",
          "X-Auto-Response-Loop": "auto-generated",
          "Auto-Submitted": "auto-generated",
        }
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
