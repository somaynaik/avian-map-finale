# Premium Email Templates for Supabase Auth

To match the look of your direct message notifications, copy and paste these HTML templates into your **Supabase Dashboard** under **Project Settings > Auth > Email Templates**.

---

## 1. Confirm Signup Template (Sign Up)

### Subject
```text
Confirm your signup on Avian Map
```

### Body (HTML)
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f4; padding: 32px 16px; margin: 0; min-height: 100%;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #15803d; padding: 18px 24px; text-align: center;">
      <img src="https://avian-map.vercel.app/avian-map-final-logo.jpeg" alt="Avian Map Logo" style="height: 48px; width: 48px; border-radius: 8px; object-fit: contain; background: #ffffff; padding: 2px; display: inline-block; vertical-align: middle; margin-right: 12px;">
      <span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; display: inline-block; vertical-align: middle; line-height: 48px;">Avian Map</span>
    </div>
    <!-- Content -->
    <div style="padding: 32px 24px; color: #1c1917;">
      <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #1c1917;">Welcome to Avian Map!</h2>
      <p style="margin-bottom: 24px; font-size: 15px; line-height: 1.6; color: #44403c;">
        Thank you for joining our community of birdwatchers. Please confirm your email address to activate your account and start mapping sightings.
      </p>
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="{{ .ConfirmationURL }}" style="background-color: #15803d; color: #ffffff; padding: 12px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);">
          Confirm Email Address
        </a>
      </div>
      <p style="margin-top: 24px; font-size: 13px; line-height: 1.5; color: #78716c; text-align: center;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #15803d; text-decoration: underline;">{{ .ConfirmationURL }}</a>
      </p>
    </div>
    <!-- Footer -->
    <div style="background-color: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #78716c; line-height: 1.5;">
        You received this email because you signed up for an account on Avian Map.<br>
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  </div>
</div>
```

---

## 2. Reset Password Template (Forgot Password)

### Subject
```text
Reset your Avian Map password
```

### Body (HTML)
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f4; padding: 32px 16px; margin: 0; min-height: 100%;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="background-color: #15803d; padding: 18px 24px; text-align: center;">
      <img src="https://avian-map.vercel.app/avian-map-final-logo.jpeg" alt="Avian Map Logo" style="height: 48px; width: 48px; border-radius: 8px; object-fit: contain; background: #ffffff; padding: 2px; display: inline-block; vertical-align: middle; margin-right: 12px;">
      <span style="color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; display: inline-block; vertical-align: middle; line-height: 48px;">Avian Map</span>
    </div>
    <!-- Content -->
    <div style="padding: 32px 24px; color: #1c1917;">
      <h2 style="margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 600; color: #1c1917;">Reset your password</h2>
      <p style="margin-bottom: 24px; font-size: 15px; line-height: 1.6; color: #44403c;">
        We received a request to reset the password for your Avian Map account. Click the button below to choose a new password.
      </p>
      <div style="text-align: center; margin: 32px 0 16px 0;">
        <a href="{{ .ConfirmationURL }}" style="background-color: #15803d; color: #ffffff; padding: 12px 28px; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);">
          Reset Password
        </a>
      </div>
      <p style="margin-top: 24px; font-size: 13px; line-height: 1.5; color: #78716c; text-align: center;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="{{ .ConfirmationURL }}" style="color: #15803d; text-decoration: underline;">{{ .ConfirmationURL }}</a>
      </p>
    </div>
    <!-- Footer -->
    <div style="background-color: #fafaf9; border-top: 1px solid #e7e5e4; padding: 20px 24px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #78716c; line-height: 1.5;">
        You received this email because a password reset request was made for your Avian Map account.<br>
        If you did not make this request, you can safely ignore this email.
      </p>
    </div>
  </div>
</div>
```
