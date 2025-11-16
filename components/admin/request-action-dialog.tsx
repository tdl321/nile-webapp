'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type ActionType = 'approve' | 'reject' | 'partial'

interface RequestActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: {
    id: string
    book_title: string
    professor_email: string
    quantity_requested: number
    quantity_available: number
  }
  action: ActionType
  onSuccess?: () => void
}

export function RequestActionDialog({
  open,
  onOpenChange,
  request,
  action,
  onSuccess
}: RequestActionDialogProps) {
  const [partialQty, setPartialQty] = useState(0)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const endpoint = `/api/admin/requests/${request.id}/${action}`
      const body = action === 'partial'
        ? { quantity_approved: partialQty }
        : action === 'reject'
        ? { rejection_reason: rejectionReason }
        : {}

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        toast.success(`Request ${action}ed successfully`)
        onOpenChange(false)
        onSuccess?.()
      } else {
        const error = await response.json()
        toast.error(error.message || `Failed to ${action} request`)
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getDialogTitle = () => {
    switch (action) {
      case 'approve':
        return 'Approve Request'
      case 'reject':
        return 'Reject Request'
      case 'partial':
        return 'Partial Fulfillment'
    }
  }

  const getDialogDescription = () => {
    switch (action) {
      case 'approve':
        return 'Confirm that you want to approve this request.'
      case 'reject':
        return 'Provide a reason for rejecting this request (optional).'
      case 'partial':
        return 'Specify how many copies you want to approve.'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Book:</span>
              <span className="font-medium">{request.book_title}</span>

              <span className="text-muted-foreground">Professor:</span>
              <span className="font-medium">{request.professor_email}</span>

              <span className="text-muted-foreground">Requested:</span>
              <span className="font-medium">{request.quantity_requested} copies</span>

              <span className="text-muted-foreground">Available:</span>
              <span className="font-medium">{request.quantity_available} copies</span>
            </div>
          </div>

          {action === 'partial' && (
            <div className="space-y-2">
              <Label htmlFor="partial-qty">Quantity to Approve</Label>
              <Input
                id="partial-qty"
                type="number"
                min="1"
                max={Math.min(request.quantity_requested, request.quantity_available)}
                value={partialQty}
                onChange={(e) => setPartialQty(Number(e.target.value))}
                placeholder={`Max: ${Math.min(request.quantity_requested, request.quantity_available)}`}
              />
            </div>
          )}

          {action === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason (optional)</Label>
              <Input
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Not enough copies available"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Processing...' : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
