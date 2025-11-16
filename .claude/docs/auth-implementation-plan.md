# Google OAuth Authentication Implementation Plan

**Project:** Nile Web App
**Date:** 2025-11-15
**Status:** Planned

## Overview

This document outlines the implementation plan for Google OAuth authentication using Supabase Auth. The implementation will use the OAuth redirect flow, protect all pages, and store Google OAuth tokens for accessing Google services on behalf of users.

## Requirements

- **Auth Flow:** OAuth redirect flow (PKCE)
- **Route Protection:** All pages require authentication
- **Google Tokens:** Store Google access and refresh tokens for API access

## Implementation Steps

### 1. Google Cloud Console Setup

Configure OAuth credentials in the Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth Client ID (Web application type)
3. Configure **Authorized JavaScript origins:**
   - `http://localhost:3000` (development)
   - Your production domain
4. Configure **Authorized redirect URIs:**
   - `https://<project-ref>.supabase.co/auth/v1/callback`
   - Add custom domain callback if applicable
5. Configure the [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent):
   - Add privacy policy and terms of service links
   - Configure scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - Add authorized domain: `<project-ref>.supabase.co`

**Note:** Save the Client ID and Client Secret for Supabase configuration.

### 2. Supabase Dashboard Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/_/auth/providers)
2. Navigate to Authentication > Providers > Google
3. Enable Google provider
4. Add OAuth credentials:
   - **OAuth client ID:** From Google Cloud Console
   - **OAuth client secret:** From Google Cloud Console
5. Configure redirect URLs in Authentication > URL Configuration
6. Save configuration

### 3. Create Supabase Client Files

#### Create `lib/supabase/client.ts`

Browser-side Supabase client for client components:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### Verify `lib/supabase/server.ts`

Ensure the existing server client supports authentication with proper cookie handling.

### 4. Create Middleware for Route Protection

Create `middleware.ts` at the project root:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect all routes except login and auth callback
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to home if already logged in and trying to access login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 5. Create Authentication Pages

#### Create `app/login/page.tsx`

Login page with Google sign-in button:

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Error signing in:', error)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to Nile</h1>
          <p className="mt-2 text-gray-600">Sign in to continue</p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
```

#### Create `app/auth/callback/route.ts`

OAuth callback handler for code exchange:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Store Google provider tokens for later use
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token

      // TODO: Store these tokens securely in your database if you need to access Google APIs
      // Example: Store in a user_tokens table linked to the user's ID

      console.log('Google access token available:', !!providerToken)
      console.log('Google refresh token available:', !!providerRefreshToken)

      // Redirect to home page
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // If error or no code, redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
```

### 6. Create Auth Context (Optional but Recommended)

Create `contexts/AuthContext.tsx` for managing auth state:

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

type AuthContextType = {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

### 7. Update Root Layout

Modify `app/layout.tsx` to include the AuthProvider:

```typescript
import { AuthProvider } from '@/contexts/AuthContext'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

### 8. Update Home Page

Modify `app/page.tsx` to show authenticated content:

```typescript
'use client'

import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Welcome to Nile!</h1>

        {user && (
          <div className="rounded-lg border p-6 space-y-4">
            <p className="text-lg">
              Signed in as: <strong>{user.email}</strong>
            </p>

            <button
              onClick={signOut}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 9. Environment Variables

Update `.env` to document required variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://uwbkvpllovfnuylsddht.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Books API
GOOGLE_BOOKS_API_KEY=your-google-books-api-key

# Google OAuth (configured in Supabase Dashboard)
# These are set in the Supabase Dashboard under Authentication > Providers > Google
# GOOGLE_OAUTH_CLIENT_ID - set in dashboard
# GOOGLE_OAUTH_CLIENT_SECRET - set in dashboard
```

### 10. Storing Google Tokens (Optional)

If you need to access Google APIs on behalf of users, create a database table to store tokens:

```sql
-- Create table for storing provider tokens
CREATE TABLE user_provider_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE user_provider_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own tokens
CREATE POLICY "Users can read own tokens"
  ON user_provider_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert/update tokens
CREATE POLICY "Service role can manage tokens"
  ON user_provider_tokens
  FOR ALL
  USING (auth.role() = 'service_role');
```

Then update the callback route to store tokens:

```typescript
// In app/auth/callback/route.ts
if (!error && data.session) {
  const providerToken = data.session.provider_token
  const providerRefreshToken = data.session.provider_refresh_token

  if (providerToken && data.session.user) {
    // Store tokens in database
    const supabaseAdmin = await createServiceRoleClient()
    await supabaseAdmin
      .from('user_provider_tokens')
      .upsert({
        user_id: data.session.user.id,
        provider: 'google',
        access_token: providerToken,
        refresh_token: providerRefreshToken,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      })
  }
}
```

## Testing Checklist

- [ ] Google OAuth credentials configured in Google Cloud Console
- [ ] Supabase Auth provider configured with Google credentials
- [ ] Client and server Supabase clients created
- [ ] Middleware protects all routes except login and auth callback
- [ ] Login page displays Google sign-in button
- [ ] OAuth callback successfully exchanges code for session
- [ ] User is redirected to home page after successful login
- [ ] Session persists across page refreshes
- [ ] Sign out functionality works correctly
- [ ] Google tokens are stored (if required)
- [ ] Middleware redirects unauthenticated users to login
- [ ] Authenticated users cannot access login page

## Files to Create/Modify

### New Files
- `lib/supabase/client.ts`
- `middleware.ts`
- `app/login/page.tsx`
- `app/auth/callback/route.ts`
- `contexts/AuthContext.tsx`

### Modified Files
- `app/layout.tsx`
- `app/page.tsx`
- `.env` (documentation)

## References

- [Supabase Auth with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Next.js Server-Side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase SSR Package](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

## Notes

- The OAuth flow uses PKCE (Proof Key for Code Exchange) for enhanced security
- Sessions are stored in HTTP-only cookies managed by Supabase SSR
- Middleware automatically refreshes expired sessions
- Google refresh tokens require `access_type: 'offline'` and `prompt: 'consent'`
- Provider tokens are available in the session after successful authentication
