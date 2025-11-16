# UI Implementation Plan: Professor and Admin Interfaces

**Project:** Nile Web App
**Date:** 2025-11-16
**Status:** Planning

## Overview

This document outlines the complete UI implementation for the Nile webapp, featuring two distinct user interfaces:
- **Professor Interface**: Request books by ISBN with availability visibility
- **Admin Interface**: Manage complete book inventory and process professor requests

## User Roles & Capabilities

### Professors
- Enter ISBN manually to request books
- See current book availability before requesting
- Specify quantity needed
- View their own request history and status

### Admin
- View all books in the database
- See real-time request data from professors
- Approve or reject requests
- Partially fulfill requests (approve fewer copies than requested)
- Monitor inventory levels

## Page Architecture

### Route Structure

```
/                           → Landing/Home page (redirects based on role)
/login                      → Google OAuth login (from auth-implementation-plan.md)
/auth/callback              → OAuth callback handler

/professor
  /request                  → Main request page for professors
  /history                  → Request history (optional)

/admin
  /dashboard                → Main admin dashboard
  /inventory                → Detailed book inventory view
  /requests                 → Request management interface
```

### Role-Based Routing

**Implementation Strategy:**
1. Check user role from Supabase auth metadata or database
2. Redirect based on role after login:
   - Professors → `/professor/request`
   - Admin → `/admin/dashboard`

## Professor Interface

### Page: `/professor/request`

#### Layout Structure

```
┌────────────────────────────────────────────────────────┐
│ [Logo] Nile Book Request          [User Menu ▼]       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Request a Book                          [Card]   │ │
│  ├──────────────────────────────────────────────────┤ │
│  │                                                  │ │
│  │  ISBN Number                         [Label]    │ │
│  │  ┌────────────────────────────────┐  [Input]    │ │
│  │  │ 9780140328721                  │             │ │
│  │  └────────────────────────────────┘             │ │
│  │                                                  │ │
│  │  ┌─ Book Details ────────────────────────────┐  │ │
│  │  │                                 [Card]    │  │ │
│  │  │  📖 The Odyssey                          │  │ │
│  │  │  by Homer                                │  │ │
│  │  │  Publisher: Penguin Classics             │  │ │
│  │  │                                          │  │ │
│  │  │  📊 Availability: 5 copies  [Badge]      │  │ │
│  │  │  [In Stock badge - green]                │  │ │
│  │  │                            [Skeleton]    │  │ │
│  │  └──────────────────────────────────────────┘  │ │
│  │                                                  │ │
│  │  Quantity Needed                     [Label]    │ │
│  │  ┌─────┐                             [Input]    │ │
│  │  │  3  │                                        │ │
│  │  └─────┘                                        │ │
│  │                                                  │ │
│  │  [Submit Request]                    [Button]   │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ My Recent Requests ──────────────────────────┐   │
│  │                                     [Card]     │   │
│  │  ┌────────────────────────────────────────┐   │   │
│  │  │ ISBN  │ Title  │ Qty │ Status  │ Date  │   │   │
│  │  ├────────────────────────────────────────┤   │   │
│  │  │ 978.. │ Book 1 │ 2   │ Pending │ Nov15 │   │   │
│  │  │ 978.. │ Book 2 │ 1   │ Approved│ Nov14 │   │   │
│  │  │ 978.. │ Book 3 │ 5   │ Partial │ Nov13 │   │   │
│  │  └────────────────────────────────────────┘   │   │
│  │                                  [Table]       │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Required shadcn Components

**Form Components:**
1. `form` - Form wrapper with react-hook-form integration
2. `input` - ISBN text input
3. `input` (type="number") - Quantity input
4. `label` - Form field labels
5. `button` - Submit request button

**Display Components:**
6. `card` - Container for form and book details
7. `badge` - Availability status indicators
   - "In Stock" (green)
   - "Low Stock" (yellow)
   - "Out of Stock" (red)
8. `skeleton` - Loading state while fetching book data
9. `alert` - Error messages (invalid ISBN, API errors)

**Data Display:**
10. `table` - Request history
11. `separator` - Visual section dividers

**Feedback:**
12. `toast` - Success/error notifications after submission

#### User Flow

1. **ISBN Entry:**
   ```typescript
   // OnChange event triggers
   - Debounced validation (check format)
   - If valid: Fetch book data from database
   - Display skeleton during fetch
   - Show book details + availability
   ```

2. **Availability Display:**
   ```typescript
   // After fetching book data
   - Show book metadata (title, author, publisher, thumbnail)
   - Display current quantity with badge
   - Color code: green (5+), yellow (1-4), red (0)
   ```

3. **Request Submission:**
   ```typescript
   // On submit
   - Validate quantity > 0
   - POST to /api/professor/request
   - Show toast notification
   - Refresh request history table
   - Clear form
   ```

#### Data Requirements

**Book Lookup:**
```typescript
// GET /api/books/:isbn
{
  isbn: string
  title: string
  authors: string[]
  publisher: string
  thumbnail_url: string
  quantity_available: number
}
```

**Submit Request:**
```typescript
// POST /api/professor/request
{
  isbn: string
  quantity_requested: number
  professor_email: string  // From auth context
}

// Response
{
  success: boolean
  request_id: string
  message: string
}
```

**Request History:**
```typescript
// GET /api/professor/requests
[{
  id: string
  isbn: string
  book_title: string
  quantity_requested: number
  status: 'pending' | 'approved' | 'rejected' | 'partial'
  quantity_approved?: number
  created_at: string
}]
```

## Admin Interface

### Page: `/admin/dashboard`

#### Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo] Nile - Admin Dashboard              [User Menu ▼]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ [All Books] [Pending Requests] [Statistics]    <-- [Tabs]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ Quick Stats ──────────────────────────────────────────┐  │
│ │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│ │  │ 1,234    │  │    42    │  │    8     │  [Card x3] │  │
│ │  │ Books    │  │ Pending  │  │ Low Stock│            │  │
│ │  └──────────┘  └──────────┘  └──────────┘            │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Search: [____________]  Filter: [Status ▼]  [Export]        │
│        [Input]                  [Select]     [Button]       │
│                                                              │
│ ┌─ Inventory & Requests ────────────────────────────────┐   │
│ │                                             [Table]   │   │
│ │ ┌──────────────────────────────────────────────────┐ │   │
│ │ │ ISBN  │ Title  │ Qty │ Requests │ Actions       │ │   │
│ │ ├──────────────────────────────────────────────────┤ │   │
│ │ │ 978.. │ Book 1 │  5  │ 2 [Badge]│ [View]        │ │   │
│ │ │   └─ Expand: prof1@edu (2 copies) - Pending     │ │   │
│ │ │       ├─ [Approve] [Reject] [Partial]           │ │   │
│ │ │       └─ prof2@edu (1 copy) - Pending           │ │   │
│ │ │           [Approve] [Reject] [Partial]          │ │   │
│ │ ├──────────────────────────────────────────────────┤ │   │
│ │ │ 978.. │ Book 2 │  0  │ 1 [Badge]│ [View]        │ │   │
│ │ │ 978.. │ Book 3 │ 12  │ 0        │ -             │ │   │
│ │ └──────────────────────────────────────────────────┘ │   │
│ │                           [Scroll Area]              │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

#### Required shadcn Components

**Layout & Navigation:**
1. `tabs` - Switch between views (All Books, Pending Requests, Statistics)
2. `card` - Stat cards and section containers
3. `separator` - Section dividers

**Data Display:**
4. `table` (or `data-table`) - Main inventory table with advanced features
   - Sortable columns
   - Expandable rows for request details
   - Pagination
5. `badge` - Request count indicators, status badges
6. `scroll-area` - Smooth scrolling for long tables

**Filters & Search:**
7. `input` - Search bar
8. `select` - Status filter dropdown
9. `button` - Export, refresh actions

**Request Actions:**
10. `dialog` - Confirmation modals for actions
    - Approve confirmation
    - Reject with reason
    - Partial fulfillment input
11. `button` - Action buttons (Approve, Reject, Partial)

**Advanced Features:**
12. `collapsible` or `accordion` - Expandable request rows
13. `dropdown-menu` - Bulk actions menu
14. `skeleton` - Loading states during data fetch
15. `toast` - Action feedback notifications

**Forms (in dialogs):**
16. `form` - For partial fulfillment
17. `label` - Dialog form labels
18. `textarea` - Rejection reason (optional)

#### Admin Dashboard Tabs

##### Tab 1: All Books

Shows complete inventory with pending requests:

```typescript
// Table columns
- ISBN (sortable)
- Title (sortable, searchable)
- Author (searchable)
- Quantity Available (sortable)
- Pending Requests (badge with count)
- Actions (expand/view)

// Expandable row content
- List of professor requests for this book
- Each request shows:
  - Professor email
  - Quantity requested
  - Date requested
  - Action buttons
```

##### Tab 2: Pending Requests

Filtered view showing only books with pending requests:

```typescript
// Table columns
- Professor Email
- ISBN
- Book Title
- Qty Requested
- Qty Available
- Status
- Requested Date
- Actions

// Actions
- Approve (opens confirmation dialog)
- Reject (opens dialog with reason textarea)
- Partial (opens dialog with quantity input)
```

##### Tab 3: Statistics

Analytics dashboard:

```typescript
// Cards
- Total books in inventory
- Total requests (all time)
- Pending requests count
- Approval rate
- Low stock alerts

// Charts (future enhancement)
- Requests over time
- Most requested books
- Category distribution
```

#### Action Workflows

##### Approve Request

```typescript
// User clicks "Approve" button
1. Open confirmation dialog
2. Dialog shows:
   - Book title
   - Professor email
   - Quantity requested
   - Current availability
3. Confirm → POST /api/admin/requests/:id/approve
4. Update UI with toast notification
5. Refresh table data
6. Close dialog
```

##### Partial Fulfillment

```typescript
// User clicks "Partial" button
1. Open dialog with form
2. Form fields:
   - Book title (read-only)
   - Quantity requested (read-only)
   - Quantity available (read-only)
   - Quantity to approve (input, max = min(requested, available))
3. Submit → POST /api/admin/requests/:id/partial
   {
     quantity_approved: number
   }
4. Update UI with toast
5. Refresh table
6. Close dialog
```

##### Reject Request

```typescript
// User clicks "Reject" button
1. Open dialog with form
2. Form fields:
   - Reason for rejection (textarea, optional)
3. Submit → POST /api/admin/requests/:id/reject
   {
     rejection_reason?: string
   }
4. Update UI with toast
5. Refresh table
6. Close dialog
```

### Page: `/admin/inventory`

Detailed inventory management view (optional, can be part of dashboard):

```
- Full book details
- Edit book quantities
- Add new books manually
- Archive/delete books
```

### Page: `/admin/requests`

Dedicated request management view (optional, can be part of dashboard):

```
- All requests (past and present)
- Filter by status, date, professor
- Bulk actions
- Export to CSV
```

## Database Schema Requirements

### Tables Needed

#### `books` table
```sql
-- From implementation-plan.md
isbn TEXT PRIMARY KEY
title TEXT
authors TEXT[]
publisher TEXT
thumbnail_url TEXT
quantity_available INTEGER  -- NEW: Current inventory count
-- ... other fields
```

#### `professor_requests` table
```sql
CREATE TABLE professor_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professor_id UUID REFERENCES auth.users(id),
  professor_email TEXT NOT NULL,
  isbn TEXT REFERENCES books(isbn),
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
  rejection_reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_requests_professor ON professor_requests(professor_id);
CREATE INDEX idx_requests_isbn ON professor_requests(isbn);
CREATE INDEX idx_requests_status ON professor_requests(status);

-- RLS Policies
ALTER TABLE professor_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can read own requests"
  ON professor_requests FOR SELECT
  USING (auth.uid() = professor_id);

CREATE POLICY "Professors can insert own requests"
  ON professor_requests FOR INSERT
  WITH CHECK (auth.uid() = professor_id);

CREATE POLICY "Admins can read all requests"
  ON professor_requests FOR SELECT
  USING (is_admin());  -- Custom function to check admin role

CREATE POLICY "Admins can update requests"
  ON professor_requests FOR UPDATE
  USING (is_admin());
```

#### `user_roles` table
```sql
CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('professor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## API Endpoints Required

### Professor Endpoints

```typescript
// Get book details by ISBN
GET /api/books/:isbn
Response: {
  isbn: string
  title: string
  authors: string[]
  publisher: string
  thumbnail_url: string
  quantity_available: number
}

// Submit book request
POST /api/professor/request
Body: {
  isbn: string
  quantity_requested: number
}
Response: {
  success: boolean
  request_id: string
  message: string
}

// Get professor's request history
GET /api/professor/requests
Response: [{
  id: string
  isbn: string
  book_title: string
  quantity_requested: number
  quantity_approved?: number
  status: string
  requested_at: string
  processed_at?: string
}]
```

### Admin Endpoints

```typescript
// Get all books with request counts
GET /api/admin/books
Query: ?search=keyword&sort=title&order=asc
Response: [{
  isbn: string
  title: string
  authors: string[]
  quantity_available: number
  pending_requests_count: number
  thumbnail_url: string
}]

// Get all requests (optionally filtered)
GET /api/admin/requests
Query: ?status=pending&professor_email=xxx&isbn=xxx
Response: [{
  id: string
  professor_email: string
  isbn: string
  book_title: string
  quantity_requested: number
  quantity_available: number
  status: string
  requested_at: string
}]

// Approve request
POST /api/admin/requests/:id/approve
Response: {
  success: boolean
  message: string
}

// Partially approve request
POST /api/admin/requests/:id/partial
Body: {
  quantity_approved: number
}
Response: {
  success: boolean
  message: string
}

// Reject request
POST /api/admin/requests/:id/reject
Body: {
  rejection_reason?: string
}
Response: {
  success: boolean
  message: string
}
```

## Real-time Features with Supabase

### Supabase Realtime Subscriptions

#### Professor View
```typescript
// Listen for updates to own requests
const subscription = supabase
  .channel('professor_requests')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'professor_requests',
      filter: `professor_id=eq.${userId}`
    },
    (payload) => {
      // Update request history table
      refreshRequestHistory()
      // Show toast if status changed
      if (payload.eventType === 'UPDATE') {
        showStatusUpdateToast(payload.new.status)
      }
    }
  )
  .subscribe()
```

#### Admin View
```typescript
// Listen for new requests
const subscription = supabase
  .channel('admin_requests')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'professor_requests'
    },
    (payload) => {
      // Update pending requests count
      incrementPendingCount()
      // Show notification toast
      showNewRequestToast(payload.new)
      // Refresh table if viewing requests
      refreshRequestsTable()
    }
  )
  .subscribe()
```

### Real-time Updates Strategy

1. **Optimistic UI Updates:**
   - Update UI immediately on action
   - Revert if API call fails

2. **Polling Fallback:**
   - If realtime connection fails
   - Poll every 30 seconds for updates

3. **Manual Refresh:**
   - Provide refresh button
   - Pull-to-refresh on mobile

## Component Installation Plan

### Phase 1: Essential Components (Install First)

```bash
npx shadcn@latest add form input button label card table badge toast
```

**Usage:**
- Professor request form
- Basic request history table
- Admin book inventory table

### Phase 2: Feedback & Loading

```bash
npx shadcn@latest add skeleton alert separator
```

**Usage:**
- Loading states while fetching data
- Error messages for invalid ISBN
- Section dividers

### Phase 3: Admin Features

```bash
npx shadcn@latest add dialog tabs select scroll-area
```

**Usage:**
- Action confirmation dialogs
- Dashboard tab navigation
- Filters and search
- Scrollable tables

### Phase 4: Advanced Features

```bash
npx shadcn@latest add collapsible dropdown-menu textarea
```

**Usage:**
- Expandable request rows
- Bulk actions
- Rejection reason input

### Phase 5: Enhancement (Optional)

```bash
npx shadcn@latest add data-table combobox calendar
```

**Usage:**
- Advanced table features (sorting, filtering)
- Advanced search with autocomplete
- Date range filters

## Implementation Workflow

### Step 1: Database Setup
1. Create `professor_requests` table
2. Create `user_roles` table
3. Add `quantity_available` to `books` table
4. Set up RLS policies
5. Create `is_admin()` helper function

### Step 2: API Endpoints
1. Implement book lookup endpoint
2. Implement professor request submission
3. Implement admin request management endpoints
4. Add request history endpoints

### Step 3: Professor Interface
1. Install Phase 1 & 2 components
2. Create request form component
3. Implement ISBN lookup with debouncing
4. Add book availability display
5. Build request history table
6. Set up real-time subscriptions
7. Add form validation and error handling

### Step 4: Admin Interface
1. Install Phase 3 & 4 components
2. Create dashboard layout with tabs
3. Build inventory table component
4. Implement expandable request rows
5. Create action dialogs (approve, reject, partial)
6. Add filters and search
7. Set up real-time updates
8. Build statistics cards

### Step 5: Testing & Polish
1. Test all user flows
2. Add loading states
3. Implement error boundaries
4. Test real-time updates
5. Mobile responsive testing
6. Accessibility audit
7. Performance optimization

## Component Examples

### Professor Request Form

```typescript
// components/professor/request-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'

export function RequestForm() {
  const [bookData, setBookData] = useState(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const form = useForm()

  const handleIsbnChange = async (isbn: string) => {
    if (isbn.length >= 10) {
      setLoading(true)
      // Fetch book data
      const response = await fetch(`/api/books/${isbn}`)
      const data = await response.json()
      setBookData(data)
      setLoading(false)
    }
  }

  const onSubmit = async (data: any) => {
    // Submit request
    const response = await fetch('/api/professor/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (response.ok) {
      toast({ title: 'Request submitted successfully!' })
      form.reset()
      setBookData(null)
    }
  }

  return (
    <Card className="p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            name="isbn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ISBN Number</FormLabel>
                <Input
                  {...field}
                  onChange={(e) => {
                    field.onChange(e)
                    handleIsbnChange(e.target.value)
                  }}
                  placeholder="9780140328721"
                />
              </FormItem>
            )}
          />

          {loading && <Skeleton className="h-32" />}

          {bookData && (
            <Card className="p-4">
              <h3 className="font-semibold">{bookData.title}</h3>
              <p className="text-sm text-gray-600">{bookData.authors.join(', ')}</p>
              <Badge variant={bookData.quantity_available > 0 ? 'default' : 'destructive'}>
                {bookData.quantity_available > 0
                  ? `${bookData.quantity_available} copies available`
                  : 'Out of stock'}
              </Badge>
            </Card>
          )}

          <FormField
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity Needed</FormLabel>
                <Input {...field} type="number" min="1" />
              </FormItem>
            )}
          />

          <Button type="submit">Submit Request</Button>
        </form>
      </Form>
    </Card>
  )
}
```

### Admin Request Actions Dialog

```typescript
// components/admin/request-action-dialog.tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

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
}

export function RequestActionDialog({
  open,
  onOpenChange,
  request,
  action
}: RequestActionDialogProps) {
  const [partialQty, setPartialQty] = useState(0)
  const [rejectionReason, setRejectionReason] = useState('')
  const { toast } = useToast()

  const handleConfirm = async () => {
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
      toast({ title: `Request ${action}ed successfully` })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === 'approve' && 'Approve Request'}
            {action === 'reject' && 'Reject Request'}
            {action === 'partial' && 'Partial Fulfillment'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p><strong>Book:</strong> {request.book_title}</p>
            <p><strong>Professor:</strong> {request.professor_email}</p>
            <p><strong>Requested:</strong> {request.quantity_requested} copies</p>
            <p><strong>Available:</strong> {request.quantity_available} copies</p>
          </div>

          {action === 'partial' && (
            <div>
              <Label>Quantity to Approve</Label>
              <Input
                type="number"
                min="1"
                max={Math.min(request.quantity_requested, request.quantity_available)}
                value={partialQty}
                onChange={(e) => setPartialQty(Number(e.target.value))}
              />
            </div>
          )}

          {action === 'reject' && (
            <div>
              <Label>Reason (optional)</Label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Not enough copies available"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Confirm {action.charAt(0).toUpperCase() + action.slice(1)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Styling & Design Tokens

### Color Scheme

**Brand Color Palette:**
```css
/* Primary brand colors */
--brand-primary: #D6A99D      /* rgb(214, 169, 157) - Dusty Rose */
--brand-secondary: #FBF3D5    /* rgb(251, 243, 213) - Cream */
--brand-tertiary: #D6DAC8     /* rgb(214, 218, 200) - Sage */
--brand-accent: #9CAFAA       /* rgb(156, 175, 170) - Muted Teal */
```

Using shadcn's default theme with customizations:

```css
/* Status colors */
--status-pending: hsl(45, 100%, 51%)     /* Yellow */
--status-approved: hsl(142, 76%, 36%)    /* Green */
--status-rejected: hsl(0, 84%, 60%)      /* Red */
--status-partial: hsl(217, 91%, 60%)     /* Blue */

/* Inventory levels */
--stock-high: hsl(142, 76%, 36%)         /* Green - 5+ */
--stock-medium: hsl(45, 100%, 51%)       /* Yellow - 1-4 */
--stock-low: hsl(0, 84%, 60%)            /* Red - 0 */
```

### Badge Variants

```typescript
// Request status badges
<Badge variant="default">Pending</Badge>       // Yellow
<Badge variant="success">Approved</Badge>      // Green
<Badge variant="destructive">Rejected</Badge>  // Red
<Badge variant="secondary">Partial</Badge>     // Blue

// Stock level badges
<Badge variant="success">In Stock (5)</Badge>
<Badge variant="warning">Low Stock (2)</Badge>
<Badge variant="destructive">Out of Stock</Badge>
```

## Responsive Design Considerations

### Mobile Layout Adaptations

**Professor Request Page:**
- Form fields stack vertically (already default)
- Table becomes horizontally scrollable
- Reduce card padding

**Admin Dashboard:**
- Tabs remain horizontal (scroll if needed)
- Table columns prioritized:
  - Mobile: Title, Qty, Actions only
  - Tablet: + ISBN, Requests
  - Desktop: All columns
- Stat cards stack vertically
- Dialog takes full screen on mobile

### Breakpoints

```css
/* Tailwind defaults */
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Large screens */
```

## Accessibility Requirements

1. **Keyboard Navigation:**
   - All actions accessible via keyboard
   - Tab order follows visual flow
   - Focus indicators visible

2. **Screen Readers:**
   - ARIA labels on all interactive elements
   - Status announcements for actions
   - Table headers properly marked

3. **Color Contrast:**
   - All text meets WCAG AA standards
   - Status not conveyed by color alone (use icons + text)

4. **Form Validation:**
   - Error messages announced
   - Required fields marked
   - Validation feedback immediate

## Performance Optimization

1. **Data Fetching:**
   - Debounce ISBN lookup (500ms)
   - Pagination for large tables (50 items/page)
   - Lazy load book thumbnails

2. **Real-time Updates:**
   - Throttle UI updates (max 1/second)
   - Batch multiple changes
   - Optimistic updates for better UX

3. **Component Optimization:**
   - Memoize heavy components
   - Virtualize long tables (if >100 rows)
   - Code split admin components

## Testing Checklist

### Professor Interface
- [ ] ISBN validation works correctly
- [ ] Book lookup displays accurate data
- [ ] Availability badge shows correct color
- [ ] Quantity validation (must be > 0)
- [ ] Request submission succeeds
- [ ] Toast notifications display
- [ ] Request history updates in real-time
- [ ] Form clears after submission
- [ ] Loading states display during fetch
- [ ] Error states handle API failures

### Admin Interface
- [ ] All books display in inventory table
- [ ] Request counts are accurate
- [ ] Search filters work correctly
- [ ] Table sorting functions
- [ ] Expandable rows show requests
- [ ] Approve action works
- [ ] Reject action works
- [ ] Partial fulfillment validates quantity
- [ ] Real-time updates refresh UI
- [ ] Dialogs open/close correctly
- [ ] Statistics cards show accurate data
- [ ] Tabs switch correctly

## Future Enhancements

1. **Notifications:**
   - Email notifications for status changes
   - Push notifications for admins (new requests)

2. **Analytics:**
   - Charts for request trends
   - Most requested books
   - Professor activity reports

3. **Bulk Operations:**
   - Multi-select requests
   - Bulk approve/reject
   - CSV export

4. **Advanced Filters:**
   - Date range picker
   - Multi-field search
   - Saved filter presets

5. **Book Management:**
   - Add books manually
   - Edit book quantities
   - Upload book cover images

## Success Criteria

- [ ] shadcn components installed successfully
- [ ] Professor can request books via ISBN
- [ ] Availability displays before request submission
- [ ] Admin sees all books in inventory
- [ ] Admin can view pending requests
- [ ] Admin can approve requests
- [ ] Admin can reject requests
- [ ] Admin can partially fulfill requests
- [ ] Real-time updates work for both roles
- [ ] Mobile responsive layouts work
- [ ] All accessibility requirements met
- [ ] Performance targets achieved (<3s page load)

## Files to Create

### Components
- `components/professor/request-form.tsx`
- `components/professor/request-history-table.tsx`
- `components/admin/dashboard-layout.tsx`
- `components/admin/inventory-table.tsx`
- `components/admin/request-action-dialog.tsx`
- `components/admin/stats-cards.tsx`
- `components/ui/*` (shadcn components)

### Pages
- `app/professor/request/page.tsx`
- `app/admin/dashboard/page.tsx`

### API Routes
- `app/api/books/[isbn]/route.ts`
- `app/api/professor/request/route.ts`
- `app/api/professor/requests/route.ts`
- `app/api/admin/books/route.ts`
- `app/api/admin/requests/route.ts`
- `app/api/admin/requests/[id]/approve/route.ts`
- `app/api/admin/requests/[id]/reject/route.ts`
- `app/api/admin/requests/[id]/partial/route.ts`

### Database Migrations
- `supabase/migrations/YYYYMMDD_create_professor_requests.sql`
- `supabase/migrations/YYYYMMDD_create_user_roles.sql`
- `supabase/migrations/YYYYMMDD_add_quantity_to_books.sql`

## References

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React Hook Form](https://react-hook-form.com)
- [Tailwind CSS](https://tailwindcss.com)
