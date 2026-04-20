# 📂 Project Structure - Authentication System

## Complete File Tree

```
feather-finder/
│
├── 📄 Configuration Files
│   ├── .env.example                    # Environment variables template
│   ├── .gitignore                      # Git ignore rules
│   ├── package.json                    # Dependencies (includes @supabase/supabase-js)
│   ├── tsconfig.json                   # TypeScript config
│   ├── vite.config.ts                  # Vite config
│   └── tailwind.config.ts              # Tailwind CSS config
│
├── 📚 Documentation
│   ├── README.md                       # Main readme (updated with auth info)
│   ├── AUTH_SETUP.md                   # Complete setup guide
│   ├── AUTH_TESTING.md                 # Testing checklist
│   ├── AUTH_QUICK_REFERENCE.md         # Developer quick reference
│   ├── AUTHENTICATION_SUMMARY.md       # Implementation summary
│   └── PROJECT_STRUCTURE.md            # This file
│
├── 🛠️ Setup Scripts
│   ├── setup-auth.sh                   # Setup script for Mac/Linux
│   └── setup-auth.ps1                  # Setup script for Windows
│
└── src/
    │
    ├── 🔐 Authentication Core
    │   ├── contexts/
    │   │   └── AuthContext.tsx         # Global auth state management
    │   │                               # Exports: useAuth hook
    │   │                               # Provides: user, loading, signUp, signIn, signOut
    │   │
    │   └── lib/
    │       └── supabase.ts             # Supabase client configuration
    │                                   # Exports: supabase client, User type
    │
    ├── 🎨 Components
    │   ├── components/
    │   │   ├── ProtectedRoute.tsx      # Route protection wrapper
    │   │   ├── AuthDebug.tsx           # Debug component (dev only)
    │   │   ├── AppLayout.tsx           # Main app layout
    │   │   ├── BottomNav.tsx           # Bottom navigation
    │   │   ├── NavLink.tsx             # Navigation link component
    │   │   │
    │   │   └── ui/                     # shadcn/ui components
    │   │       ├── button.tsx
    │   │       ├── card.tsx
    │   │       ├── input.tsx
    │   │       ├── label.tsx
    │   │       ├── alert.tsx
    │   │       └── ... (50+ components)
    │   │
    │   └── hooks/
    │       ├── use-mobile.tsx          # Mobile detection hook
    │       └── use-toast.ts            # Toast notifications hook
    │
    ├── 📄 Pages
    │   └── pages/
    │       ├── 🔓 Public Pages (No Auth Required)
    │       │   ├── LoginPage.tsx       # Login form with validation
    │       │   ├── SignupPage.tsx      # Registration with password strength
    │       │   └── ForgotPasswordPage.tsx  # Password reset flow
    │       │
    │       └── 🔒 Protected Pages (Auth Required)
    │           ├── Index.tsx           # Landing page (fallback)
    │           ├── MapPage.tsx         # Map view (home)
    │           ├── FeedPage.tsx        # Social feed
    │           ├── CameraPage.tsx      # Camera/upload
    │           ├── MessagesPage.tsx    # Direct messages
    │           ├── UsersPage.tsx       # User directory
    │           ├── ProfilePage.tsx     # User profile (updated with logout)
    │           └── NotFound.tsx        # 404 page
    │
    ├── 🎨 Styles
    │   ├── index.css                   # Global styles
    │   └── App.css                     # App-specific styles
    │
    ├── 🧪 Tests
    │   └── test/
    │       ├── setup.ts                # Test setup
    │       └── example.test.ts         # Example test
    │
    ├── 📱 Entry Points
    │   ├── main.tsx                    # React entry point
    │   ├── App.tsx                     # Main app component (updated with auth routes)
    │   └── vite-env.d.ts               # Vite type definitions
    │
    └── 🔧 Utilities
        └── lib/
            └── utils.ts                # Utility functions (cn, etc.)
```

## 🔑 Key Files Explained

### Authentication Flow

```
1. User visits app
   ↓
2. main.tsx renders <App />
   ↓
3. App.tsx wraps everything in <AuthProvider>
   ↓
4. AuthContext.tsx checks Supabase session
   ↓
5. Routes render based on auth state
   ↓
6. ProtectedRoute.tsx guards protected pages
   ↓
7. User redirected to /login if not authenticated
```

### File Dependencies

```
App.tsx
├── imports AuthProvider from contexts/AuthContext.tsx
├── imports ProtectedRoute from components/ProtectedRoute.tsx
├── imports LoginPage from pages/LoginPage.tsx
├── imports SignupPage from pages/SignupPage.tsx
└── imports ForgotPasswordPage from pages/ForgotPasswordPage.tsx

AuthContext.tsx
└── imports supabase from lib/supabase.ts

ProtectedRoute.tsx
└── imports useAuth from contexts/AuthContext.tsx

LoginPage.tsx
├── imports useAuth from contexts/AuthContext.tsx
├── imports UI components from components/ui/
└── uses react-hook-form + zod for validation

SignupPage.tsx
├── imports useAuth from contexts/AuthContext.tsx
├── imports UI components from components/ui/
└── uses react-hook-form + zod for validation

ProfilePage.tsx
├── imports useAuth from contexts/AuthContext.tsx
└── displays user info and logout button
```

## 📊 Component Hierarchy

```
<App>
  <QueryClientProvider>
    <AuthProvider>                    ← Global auth state
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            
            <!-- Public Routes -->
            <Route path="/login">
              <LoginPage />           ← Uses useAuth()
            </Route>
            
            <Route path="/signup">
              <SignupPage />          ← Uses useAuth()
            </Route>
            
            <Route path="/forgot-password">
              <ForgotPasswordPage />  ← Uses useAuth()
            </Route>
            
            <!-- Protected Routes -->
            <Route path="/">
              <ProtectedRoute>        ← Checks auth
                <AppLayout>
                  <MapPage />
                </AppLayout>
              </ProtectedRoute>
            </Route>
            
            <Route path="/profile">
              <ProtectedRoute>        ← Checks auth
                <AppLayout>
                  <ProfilePage />     ← Uses useAuth()
                </AppLayout>
              </ProtectedRoute>
            </Route>
            
            <!-- More protected routes... -->
            
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
</App>
```

## 🔄 Data Flow

### Login Flow
```
User enters credentials
    ↓
LoginPage.tsx
    ↓
useAuth().signIn()
    ↓
AuthContext.tsx
    ↓
supabase.auth.signInWithPassword()
    ↓
lib/supabase.ts
    ↓
Supabase API
    ↓
Session created
    ↓
AuthContext updates state
    ↓
ProtectedRoute allows access
    ↓
User redirected to home
```

### Signup Flow
```
User fills registration form
    ↓
SignupPage.tsx validates with Zod
    ↓
useAuth().signUp()
    ↓
AuthContext.tsx
    ↓
supabase.auth.signUp()
    ↓
Supabase creates user
    ↓
Email verification sent
    ↓
Success message shown
    ↓
Redirect to login
```

### Protected Route Check
```
User navigates to /profile
    ↓
ProtectedRoute.tsx
    ↓
useAuth() checks user state
    ↓
If user exists: Render children
If no user: <Navigate to="/login" />
If loading: Show loading spinner
```

## 🎯 Import Paths

The project uses TypeScript path aliases:

```typescript
// Instead of: import { Button } from '../../components/ui/button'
// You can use:
import { Button } from '@/components/ui/button'

// Configured in tsconfig.json:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## 📦 Dependencies

### Production Dependencies
```json
{
  "@supabase/supabase-js": "^2.x",      // Auth & Database
  "react": "^18.x",                      // UI Framework
  "react-router-dom": "^6.x",            // Routing
  "react-hook-form": "^7.x",             // Form handling
  "@hookform/resolvers": "^3.x",         // Form validation
  "zod": "^3.x",                         // Schema validation
  "@tanstack/react-query": "^5.x",       // Data fetching
  "@radix-ui/react-*": "^1.x",           // UI primitives
  "lucide-react": "^0.x",                // Icons
  "tailwindcss": "^3.x"                  // Styling
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.x",                  // Type checking
  "vite": "^5.x",                        // Build tool
  "@vitejs/plugin-react-swc": "^3.x",    // Fast refresh
  "vitest": "^3.x",                      // Testing
  "@testing-library/react": "^16.x"      // Testing utilities
}
```

## 🚀 Build Output

```
dist/
├── index.html                    # Entry HTML
├── assets/
│   ├── index-[hash].js          # Bundled JavaScript
│   ├── index-[hash].css         # Bundled CSS
│   └── [images/fonts]           # Static assets
└── ...
```

## 📝 Environment Variables

```bash
# .env (create from .env.example)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Accessed in code as:
import.meta.env.VITE_SUPABASE_URL
import.meta.env.VITE_SUPABASE_ANON_KEY
```

## 🎨 Styling Architecture

```
Tailwind CSS (Utility-first)
    ↓
tailwind.config.ts (Theme configuration)
    ↓
index.css (Global styles + Tailwind imports)
    ↓
shadcn/ui components (Pre-styled with Tailwind)
    ↓
Your pages/components (Compose with utilities)
```

## 🧪 Testing Structure

```
src/test/
├── setup.ts                      # Test environment setup
└── example.test.ts               # Example test

# Run tests:
npm run test                      # Run once
npm run test:watch                # Watch mode
```

## 📱 Responsive Design

All pages are mobile-first and responsive:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔐 Security Layers

```
1. Environment Variables (.env)
   ↓
2. Supabase Client (lib/supabase.ts)
   ↓
3. Auth Context (contexts/AuthContext.tsx)
   ↓
4. Protected Routes (components/ProtectedRoute.tsx)
   ↓
5. Row Level Security (Supabase database)
```

## 🎯 Next Steps

See **AUTHENTICATION_SUMMARY.md** for:
- Getting started guide
- Customization options
- Next features to build
- Learning resources

Happy coding! 🚀
