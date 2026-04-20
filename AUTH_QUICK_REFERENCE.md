# Authentication Quick Reference

## 🚀 Quick Commands

```bash
# Setup (Windows)
.\setup-auth.ps1

# Setup (Mac/Linux)
chmod +x setup-auth.sh
./setup-auth.sh

# Start dev server
npm run dev

# Build for production
npm run build
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Auth state management |
| `src/lib/supabase.ts` | Supabase client config |
| `src/components/ProtectedRoute.tsx` | Route protection |
| `src/pages/LoginPage.tsx` | Login form |
| `src/pages/SignupPage.tsx` | Registration form |
| `src/pages/ForgotPasswordPage.tsx` | Password reset |
| `.env` | Environment variables (create from .env.example) |

## 🔑 Using Auth in Components

### Get current user

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not logged in</div>;
  
  return <div>Hello {user.email}!</div>;
}
```

### Sign out

```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function LogoutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  
  return <button onClick={handleLogout}>Logout</button>;
}
```

### Protect a route

```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';

// In App.tsx
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

### Check if user is authenticated

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user } = useAuth();
  
  return (
    <div>
      {user ? (
        <p>Welcome back!</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  );
}
```

## 🎨 Form Validation Patterns

### Basic form with validation

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  const onSubmit = (data: FormData) => {
    console.log(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

## 🔐 Supabase Direct Queries

### Get current session

```tsx
import { supabase } from '@/lib/supabase';

const { data: { session } } = await supabase.auth.getSession();
console.log(session);
```

### Update user metadata

```tsx
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase.auth.updateUser({
  data: { 
    username: 'newusername',
    avatar_url: 'https://...'
  }
});
```

### Sign in with OAuth

```tsx
import { supabase } from '@/lib/supabase';

await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/`,
  },
});
```

### Listen to auth changes

```tsx
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log('Auth event:', event);
      console.log('Session:', session);
    }
  );
  
  return () => subscription.unsubscribe();
}, []);
```

## 🛡️ Security Best Practices

✅ **DO:**
- Use environment variables for API keys
- Validate all user input
- Use HTTPS in production
- Enable email verification
- Implement rate limiting
- Use strong password requirements
- Keep dependencies updated

❌ **DON'T:**
- Commit `.env` file to git
- Store sensitive data in localStorage
- Trust client-side validation alone
- Use weak password requirements
- Expose API keys in client code
- Skip email verification

## 🐛 Common Errors & Fixes

### "Invalid API key"
```bash
# Check .env file exists and has correct values
cat .env

# Restart dev server
npm run dev
```

### "User already registered"
```tsx
// Handle in your signup form
if (error?.message.includes('already registered')) {
  setError('Email already in use. Try logging in instead.');
}
```

### "Invalid login credentials"
```tsx
// Show user-friendly message
if (error?.message.includes('Invalid login')) {
  setError('Email or password is incorrect.');
}
```

## 📊 User Metadata Structure

```typescript
{
  id: string;                    // UUID
  email: string;                 // User's email
  user_metadata: {
    username?: string;           // Custom field
    avatar_url?: string;         // Custom field
    full_name?: string;          // Custom field
  };
  created_at: string;            // ISO timestamp
  last_sign_in_at: string;       // ISO timestamp
}
```

## 🔗 Useful Links

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)

## 💡 Tips

1. **Development**: Use AuthDebug component to see auth state
2. **Testing**: Create test accounts with temp-mail.org
3. **Debugging**: Check browser console and Network tab
4. **Production**: Set up custom SMTP for emails
5. **Security**: Enable RLS (Row Level Security) in Supabase
