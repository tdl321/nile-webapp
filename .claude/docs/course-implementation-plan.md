# Plan: Adding Course Information to Book Requests

**Project:** Nile Web App
**Date:** 2025-11-16
**Status:** Implementation in Progress

## Overview
Add course-specific labels to professor book requests to track which courses books are being requested for. This is separate from the Google Books categories already stored.

## Recommended Approach: Hybrid Phased Implementation

### Phase 1: Quick MVP (Recommended to start)

#### Database Changes
```sql
-- Migration: Add course fields to professor_requests table
ALTER TABLE professor_requests
ADD COLUMN course_code TEXT,      -- e.g., "COSC 111", "ENGL 201"
ADD COLUMN course_name TEXT;      -- e.g., "Intro to Computer Science"

-- Both nullable for backwards compatibility with existing requests
```

#### API Updates
1. **POST /api/professor/request**
   - Accept `course_code` and `course_name` in request body
   - Store with the request

2. **GET /api/admin/books**
   - Include `course_code` and `course_name` in the requests array

3. **GET /api/professor/requests**
   - Return course info with each request

#### UI Changes - Professor Interface

**RequestForm Component:**
```tsx
// Add after book details display, before quantity input
<FormField name="course_code">
  <FormLabel>Course Code</FormLabel>
  <Input placeholder="COSC 111" />
</FormField>

<FormField name="course_name">
  <FormLabel>Course Name (optional)</FormLabel>
  <Input placeholder="Introduction to Computer Science" />
</FormField>
```

**RequestHistoryTable Component:**
- Add "Course" column between "Title" and "Qty"
- Display as: "COSC 111" or "COSC 111 - Intro to CS" if name provided

#### UI Changes - Admin Interface

**InventoryTable Expanded View:**
```tsx
// In request card, add course info display
<p className="text-sm font-medium">{request.professor_email}</p>
<p className="text-sm text-muted-foreground">
  Course: {request.course_code} {request.course_name && `- ${request.course_name}`}
</p>
<p className="text-xs text-muted-foreground">
  {request.quantity_requested} copies requested on {date}
</p>
```

**Optional Enhancements:**
- Add course code to main table view
- Filter by course in search
- Show course badge instead of plain text

---

### Phase 2: Enhanced UX (Future Enhancement)

#### Database Changes
```sql
-- Create courses table for autocomplete/validation
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_code TEXT UNIQUE NOT NULL,
  course_name TEXT NOT NULL,
  department TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);

-- Index for autocomplete
CREATE INDEX idx_courses_code ON courses(course_code);
CREATE INDEX idx_courses_department ON courses(department);
```

#### UI Enhancements
- Replace text input with **Combobox** (shadcn component)
- Autocomplete from previously used courses
- Allow custom entry if course not found
- Auto-populate course name when code is selected
- Track course usage for better suggestions

---

## Implementation Order

### Step 1: Database Migration ✅
- Create and apply migration to add course columns
- Update existing test data with sample course codes

### Step 2: Update APIs
- Modify professor request submission endpoint
- Update admin books endpoint to include course info
- Update professor requests history endpoint

### Step 3: Professor UI
- Add course input fields to RequestForm
- Add course column to RequestHistoryTable
- Update form validation

### Step 4: Admin UI
- Display course info in expanded request rows
- Optional: Add course column to main table
- Optional: Add course filter

### Step 5: Testing
- Test request submission with course info
- Verify admin view shows course data
- Test backwards compatibility (requests without course)

---

## Key Benefits

✅ **Simple to implement** - Just 2 new columns, basic text inputs
✅ **Flexible** - Professors can enter any course format
✅ **Backwards compatible** - Nullable columns don't break existing data
✅ **Clear upgrade path** - Phase 2 adds polish without breaking changes
✅ **Better tracking** - Admins see which courses need which books
✅ **Reporting ready** - Can generate reports by course later

---

## Sample UI Mockups

**Professor Request Form:**
```
┌─ Request a Book ────────────────────┐
│ ISBN Number: [9780134685991]        │
│                                      │
│ ┌─ Book Details ──────────────────┐ │
│ │ 📖 Effective Java               │ │
│ │ by Joshua Bloch                 │ │
│ │ 📊 10 copies available          │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Course Code: [COSC 111]             │
│ Course Name: [Intro to CS]          │
│ Quantity: [3]                        │
│                                      │
│ [Submit Request]                     │
└──────────────────────────────────────┘
```

**Admin Request View:**
```
┌─ Pending Requests ──────────────────────────┐
│ Prof: tli27@amherst.edu                     │
│ Course: COSC 111 - Intro to Computer Science│
│ 3 copies requested on Nov 14                │
│ [Approve] [Partial] [Reject]                │
└─────────────────────────────────────────────┘
```

---

## Technical Notes

### Database Considerations
- Course fields are nullable to support existing requests
- No foreign key constraints in Phase 1 for flexibility
- Can add validation/constraints in Phase 2

### API Considerations
- Course fields are optional in request payload
- Backwards compatible with existing API consumers
- Future: Add course filtering query params

### UI/UX Considerations
- Course code is the primary identifier
- Course name provides context but is optional
- Consider validation regex for course code format in Phase 2
  - Example: `^[A-Z]{4}\s?\d{3}$` for "COSC 111" or "COSC111"

---

## Files to Create/Modify

### Database
- `supabase/migrations/YYYYMMDD_add_course_to_requests.sql`

### API Routes
- `app/api/professor/request/route.ts` (modify)
- `app/api/admin/books/route.ts` (modify)
- `app/api/professor/requests/route.ts` (modify)

### Components
- `components/professor/request-form.tsx` (modify)
- `components/professor/request-history-table.tsx` (modify)
- `components/admin/inventory-table.tsx` (modify)

---

## Success Criteria

- [ ] Migration applied successfully
- [ ] Professor can enter course code and name when requesting books
- [ ] Course info displays in professor request history
- [ ] Admin sees course info for each pending request
- [ ] Existing requests (without course) still display correctly
- [ ] API endpoints accept and return course data
- [ ] No breaking changes to existing functionality

---

## Future Enhancements (Phase 2+)

1. **Course Management Interface**
   - Dedicated page for managing courses
   - Bulk import courses from CSV
   - Department organization

2. **Enhanced Autocomplete**
   - Suggest courses based on professor's history
   - Auto-populate course name from code
   - Validate course codes against known formats

3. **Reporting & Analytics**
   - Most requested books by course
   - Course-level book inventory tracking
   - Department budget allocation insights

4. **Integration with Academic Systems**
   - Import course catalog from SIS
   - Sync enrollment data
   - Link to course syllabi

---

## References
- [UI Implementation Plan](./ui-implementation-plan.md)
- [Auth Implementation Plan](./auth-implementation-plan.md)
- [Supabase Documentation](https://supabase.com/docs)
