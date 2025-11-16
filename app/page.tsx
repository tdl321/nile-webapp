'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function Home() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.email) return 'U'
    const email = user.email
    return email.charAt(0).toUpperCase()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Welcome Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-xl">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">Welcome to Nile!</CardTitle>
                  <CardDescription className="text-base">
                    {user?.email}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="h-fit">
                Authenticated
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Account Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">User ID</p>
                  <p className="font-mono text-xs">{user?.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Provider</p>
                  <p className="font-medium capitalize">
                    {user?.app_metadata?.provider || 'Google'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Sign In</p>
                  <p className="font-medium">
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex gap-3">
              <Button onClick={signOut} variant="destructive">
                Sign Out
              </Button>
              <Button variant="outline" asChild>
                <a href="/api/scan">View API Docs</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
