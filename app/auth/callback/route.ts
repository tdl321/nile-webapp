import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Store Google provider tokens for later use (if you need to access Google APIs)
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token

      if (providerToken && data.session.user) {
        console.log('✅ Google OAuth successful')
        console.log('User:', data.session.user.email)
        console.log('Provider token available:', !!providerToken)
        console.log('Provider refresh token available:', !!providerRefreshToken)

        // TODO: Store tokens in database if you need to access Google APIs
        // Example implementation:
        // const supabaseAdmin = await createServiceRoleClient()
        // await supabaseAdmin
        //   .from('user_provider_tokens')
        //   .upsert({
        //     user_id: data.session.user.id,
        //     provider: 'google',
        //     access_token: providerToken,
        //     refresh_token: providerRefreshToken,
        //     expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        //   })
      }

      // Redirect to home page
      return NextResponse.redirect(`${origin}/`)
    }

    console.error('❌ Auth error:', error)
  }

  // If error or no code, redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
