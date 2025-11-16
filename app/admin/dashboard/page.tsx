'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { InventoryTable } from '@/components/admin/inventory-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/components/ui/logo'

export default function AdminDashboardPage() {
  const { user, signOut } = useAuth()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/books')
      if (response.ok) {
        const data = await response.json()
        setBooks(data)
      }
    } catch (error) {
      console.error('Failed to fetch books:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBooks = books.filter((book: any) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.isbn.includes(searchQuery) ||
    book.authors.some((author: string) => author.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const pendingRequestsCount = books.reduce((sum: number, book: any) => sum + (book.pending_requests_count || 0), 0)
  const lowStockCount = books.filter((book: any) => book.quantity_available > 0 && book.quantity_available <= 4).length

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" variant="icon" className="h-8" />
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="default">Admin</Badge>
            <div className="text-sm">
              <span className="font-medium">{user?.email}</span>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Books
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{books.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequestsCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Low Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lowStockCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all-books" className="w-full">
            <TabsList>
              <TabsTrigger value="all-books">All Books</TabsTrigger>
              <TabsTrigger value="pending-requests">
                Pending Requests
                {pendingRequestsCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{pendingRequestsCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all-books" className="space-y-4">
              {/* Search & Filters */}
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Search by title, ISBN, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-md"
                />
                <Button onClick={fetchBooks} variant="outline">
                  Refresh
                </Button>
              </div>

              {/* Inventory Table */}
              <Card>
                <CardContent className="p-6">
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <InventoryTable books={filteredBooks} onRefresh={fetchBooks} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending-requests" className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <InventoryTable
                      books={books.filter((book: any) => book.pending_requests_count > 0)}
                      onRefresh={fetchBooks}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
