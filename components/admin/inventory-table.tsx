'use client'

import React, { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RequestActionDialog } from './request-action-dialog'

interface ProfessorRequest {
  id: string
  professor_email: string
  quantity_requested: number
  requested_at: string
  course_code?: string
  course_name?: string
}

interface Book {
  isbn: string
  title: string
  authors: string[]
  quantity_available: number
  pending_requests_count: number
  thumbnail_url: string
  requests?: ProfessorRequest[]
}

interface InventoryTableProps {
  books: Book[]
  onRefresh?: () => void
}

export function InventoryTable({ books, onRefresh }: InventoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | 'partial'>('approve')

  const toggleRow = (isbn: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(isbn)) {
      newExpanded.delete(isbn)
    } else {
      newExpanded.add(isbn)
    }
    setExpandedRows(newExpanded)
  }

  const handleAction = (request: ProfessorRequest, book: Book, action: 'approve' | 'reject' | 'partial') => {
    setSelectedRequest({
      id: request.id,
      book_title: book.title,
      professor_email: request.professor_email,
      quantity_requested: request.quantity_requested,
      quantity_available: book.quantity_available
    })
    setDialogAction(action)
    setDialogOpen(true)
  }

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (quantity <= 4) {
      return <Badge variant="secondary">Low Stock ({quantity})</Badge>
    }
    return <Badge className="bg-success text-success-foreground">{quantity} Available</Badge>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ISBN</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Author(s)</TableHead>
            <TableHead className="text-center">Quantity</TableHead>
            <TableHead className="text-center">Requests</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {books.map((book) => (
            <React.Fragment key={book.isbn}>
              <TableRow>
                <TableCell className="font-mono text-sm">{book.isbn}</TableCell>
                <TableCell className="font-medium">{book.title}</TableCell>
                <TableCell className="text-sm">{book.authors.join(', ')}</TableCell>
                <TableCell className="text-center">
                  {getStockBadge(book.quantity_available)}
                </TableCell>
                <TableCell className="text-center">
                  {book.pending_requests_count > 0 ? (
                    <Badge>{book.pending_requests_count}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {book.pending_requests_count > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRow(book.isbn)}
                    >
                      {expandedRows.has(book.isbn) ? 'Hide' : 'View'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
              {expandedRows.has(book.isbn) && book.requests && (
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50">
                    <div className="py-2 space-y-2">
                      <p className="font-semibold text-sm mb-2">Pending Requests:</p>
                      {book.requests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-center justify-between p-3 bg-background rounded-md border"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{request.professor_email}</p>
                            {request.course_code && (
                              <p className="text-sm text-muted-foreground">
                                Course: {request.course_code}{request.course_name && ` - ${request.course_name}`}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {request.quantity_requested} {request.quantity_requested === 1 ? 'copy' : 'copies'} requested on{' '}
                              {new Date(request.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-success text-success-foreground hover:bg-success/90 shadow-sm shadow-black/5"
                              onClick={() => handleAction(request, book, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(request, book, 'partial')}
                            >
                              Partial
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleAction(request, book, 'reject')}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      {selectedRequest && (
        <RequestActionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          request={selectedRequest}
          action={dialogAction}
          onSuccess={onRefresh}
        />
      )}
    </>
  )
}
