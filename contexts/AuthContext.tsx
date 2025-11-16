'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

// Define the shape of our auth context
type AuthContextType = {
  user: User | null        // Current user object (null if not logged in)
  loading: boolean         // Whether auth is still loading
  signOut: () => Promise<void>  // Function to sign out
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

// AuthProvider component that wraps the app
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Step 1: Get initial session when component mounts
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Step 2: Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Step 3: Cleanup subscription when component unmounts
    return () => subscription.unsubscribe()
  }, [supabase])

  // Sign out function - clears session and redirects to login
  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Provide auth state to all children
  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context in components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
