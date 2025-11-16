'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Request {
  id: string
  isbn: string
  book_title: string
  quantity_requested: number
  quantity_approved?: number
  status: 'pending' | 'approved' | 'rejected' | 'partial'
  requested_at: string
  processed_at?: string
  course_code?: string
  course_name?: string
}

export function RequestHistoryTable() {
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/professor/requests')
      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'approved':
        return <Badge className="bg-success text-success-foreground">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'partial':
        return <Badge className="bg-info text-info-foreground">Partial</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Recent Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No requests yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISBN</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-mono text-sm">
                    {request.isbn.substring(0, 13)}...
                  </TableCell>
                  <TableCell className="font-medium">{request.book_title}</TableCell>
                  <TableCell className="text-sm">
                    {request.course_code ? (
                      <div>
                        <div className="font-medium">{request.course_code}</div>
                        {request.course_name && (
                          <div className="text-muted-foreground text-xs">{request.course_name}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {request.status === 'partial' && request.quantity_approved
                      ? `${request.quantity_approved}/${request.quantity_requested}`
                      : request.quantity_requested}
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-right">{formatDate(request.requested_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
