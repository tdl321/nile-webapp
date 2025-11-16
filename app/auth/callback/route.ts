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
      console.log('✅ Google OAuth successful')
      console.log('User:', data.session.user.email)

      // Get user role to determine redirect
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.session.user.id)
        .single()

      // Role-based redirect
      if (roleData?.role === 'admin') {
        console.log('🔑 Redirecting admin to dashboard')
        return NextResponse.redirect(`${origin}/admin/dashboard`)
      } else {
        console.log('👤 Redirecting professor to request page')
        return NextResponse.redirect(`${origin}/professor/request`)
      }
    }

    console.error('❌ Auth error:', error)
  }

  // If error or no code, redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
