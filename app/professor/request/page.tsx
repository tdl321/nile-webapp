'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RequestForm } from '@/components/professor/request-form'
import { RequestHistoryTable } from '@/components/professor/request-history-table'
import { Logo } from '@/components/ui/logo'

export default function ProfessorRequestPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" variant="icon" className="h-8" />
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="default">Professor</Badge>
            <div className="text-sm">
              <span className="text-muted-foreground">Logged in as: </span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="space-y-8">
          <RequestForm />
          <RequestHistoryTable />
        </div>
      </main>
    </div>
  )
}
