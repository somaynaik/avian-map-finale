# Authentication Testing Checklist

## ✅ Manual Testing Guide

### 1. Registration Flow

- [ ] Navigate to `/signup`
- [ ] Try submitting empty form (should show validation errors)
- [ ] Enter invalid email (should show error)
- [ ] Enter password less than 8 characters (should show error)
- [ ] Enter mismatched passwords (should show error)
- [ ] Watch password strength indicator update as you type
- [ ] Submit valid registration form
- [ ] Check for success message
- [ ] Check email for verification link (if enabled)
- [ ] Verify redirect to login page

### 2. Login Flow

- [ ] Navigate to `/login`
- [ ] Try submitting empty form (should show validation errors)
- [ ] Enter wrong credentials (should show error)
- [ ] Enter correct credentials
- [ ] Verify redirect to home page (`/`)
- [ ] Check that user info appears in profile

### 3. Protected Routes

- [ ] While logged out, try accessing `/feed` (should redirect to login)
- [ ] While logged out, try accessing `/profile` (should redirect to login)
- [ ] After login, verify you can access all protected routes
- [ ] Check that navigation works correctly

### 4. Password Reset Flow

- [ ] Navigate to `/forgot-password`
- [ ] Enter invalid email (should show validation error)
- [ ] Enter valid email
- [ ] Check for success message
- [ ] Check email for reset link
- [ ] Click reset link and set new password
- [ ] Login with new password

### 5. Logout Flow

- [ ] Navigate to `/profile`
- [ ] Click "Sign out" button
- [ ] Verify redirect to login page
- [ ] Try accessing protected route (should redirect to login)
- [ ] Verify you can't access protected routes

### 6. Session Persistence

- [ ] Login to the app
- [ ] Refresh the page (should stay logged in)
- [ ] Close and reopen browser (should stay logged in)
- [ ] Open app in new tab (should be logged in)

### 7. Email Verification (if enabled)

- [ ] Register new account
- [ ] Check email for verification link
- [ ] Try logging in before verification (behavior depends on settings)
- [ ] Click verification link
- [ ] Login after verification

### 8. UI/UX Testing

- [ ] Check loading states on all forms
- [ ] Verify error messages are clear and helpful
- [ ] Test on mobile viewport (responsive design)
- [ ] Check that all links work correctly
- [ ] Verify form validation happens in real-time
- [ ] Check password visibility toggle (if implemented)

### 9. Edge Cases

- [ ] Try registering with existing email (should show error)
- [ ] Try very long username/email (should handle gracefully)
- [ ] Test with slow network (loading states should show)
- [ ] Test with network offline (should show error)
- [ ] Try SQL injection in forms (should be safe)
- [ ] Try XSS attacks in forms (should be safe)

## 🔧 Development Testing

### Check Environment Variables

```bash
# Verify .env file exists and has correct values
cat .env

# Should show:
# VITE_SUPABASE_URL=https://...
# VITE_SUPABASE_ANON_KEY=eyJ...
```

### Test Supabase Connection

```bash
# In browser console on any page:
import { supabase } from './src/lib/supabase';
const { data, error } = await supabase.auth.getSession();
console.log('Session:', data, 'Error:', error);
```

### Check Auth State

Add the AuthDebug component to see real-time auth state:

```tsx
// In App.tsx (for development only)
import { AuthDebug } from './components/AuthDebug';

// Add inside your app:
<AuthDebug />
```

## 🐛 Common Issues & Solutions

### Issue: "Invalid API key"
**Solution:** 
- Check `.env` file exists
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct
- Restart dev server after changing .env

### Issue: Email not sending
**Solution:**
- Check Supabase email settings
- For development, check Supabase dashboard → Authentication → Users
- Email verification links appear in dashboard if SMTP not configured

### Issue: Infinite redirect loop
**Solution:**
- Check that login page is not wrapped in ProtectedRoute
- Verify auth state is loading correctly
- Check browser console for errors

### Issue: User stays logged in after logout
**Solution:**
- Clear browser localStorage and cookies
- Check that signOut() is being called correctly
- Verify Supabase session is being cleared

### Issue: Form validation not working
**Solution:**
- Check that Zod schema is correct
- Verify react-hook-form is properly configured
- Check browser console for validation errors

## 📊 Automated Testing (Future)

### Unit Tests to Add

```typescript
// Example test structure
describe('AuthContext', () => {
  it('should sign up user', async () => {
    // Test signup functionality
  });

  it('should sign in user', async () => {
    // Test login functionality
  });

  it('should sign out user', async () => {
    // Test logout functionality
  });
});

describe('ProtectedRoute', () => {
  it('should redirect unauthenticated users', () => {
    // Test route protection
  });

  it('should allow authenticated users', () => {
    // Test authenticated access
  });
});
```

### Integration Tests to Add

- Test complete registration → verification → login flow
- Test password reset flow end-to-end
- Test session persistence across page reloads
- Test concurrent sessions in multiple tabs

## 🚀 Production Checklist

Before deploying to production:

- [ ] Remove or disable AuthDebug component
- [ ] Set up custom SMTP for email sending
- [ ] Configure proper redirect URLs in Supabase
- [ ] Enable email verification requirement
- [ ] Set up rate limiting for auth endpoints
- [ ] Configure password complexity requirements
- [ ] Set up monitoring and error tracking
- [ ] Test with real email addresses
- [ ] Verify SSL/HTTPS is enabled
- [ ] Review and update privacy policy
- [ ] Set up backup authentication method
- [ ] Configure session timeout settings
- [ ] Test on multiple browsers and devices
