# API Testing Guide

**Project:** Nile Web App
**Date:** 2025-11-16
**Purpose:** Quick reference for testing API endpoints and troubleshooting common errors

---

## API Endpoints Overview

### Professor Endpoints

#### 1. GET /api/books/:isbn
**Purpose:** Fetch book details by ISBN including availability

**Test URL:** `/api/books/9780134685991`

**Expected Response:**
```json
{
  "isbn": "9780134685991",
  "title": "Effective Java",
  "subtitle": "...",
  "authors": ["Joshua Bloch"],
  "publisher": "Addison-Wesley Professional",
  "published_date": "...",
  "thumbnail_url": "...",
  "quantity_available": 10
}
```

**Common Errors:**
- `400 Bad Request` - Invalid ISBN format (less than 10 characters)
- `404 Not Found` - Book doesn't exist in database
- `500 Internal Server Error` - Database connection issue

---

#### 2. POST /api/professor/request
**Purpose:** Submit a book request as a professor

**Test Body:**
```json
{
  "isbn": "9780134685991",
  "quantity_requested": 3
}
```

**Expected Response:**
```json
{
  "success": true,
  "request_id": "uuid-here",
  "message": "Request submitted for \"Effective Java\""
}
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `400 Bad Request` - Missing isbn or quantity_requested, or quantity < 1
- `404 Not Found` - Book with that ISBN doesn't exist
- `500 Internal Server Error` - Failed to create request in database

---

#### 3. GET /api/professor/requests
**Purpose:** Get request history for logged-in professor

**Test URL:** `/api/professor/requests`

**Expected Response:**
```json
[
  {
    "id": "uuid",
    "isbn": "9780134685991",
    "book_title": "Effective Java",
    "book_authors": ["Joshua Bloch"],
    "book_thumbnail": "...",
    "quantity_requested": 3,
    "quantity_approved": null,
    "status": "pending",
    "rejection_reason": null,
    "requested_at": "2025-11-16T...",
    "processed_at": null
  }
]
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `500 Internal Server Error` - Database query failed

---

### Admin Endpoints

#### 4. GET /api/admin/books
**Purpose:** Get all books with pending request counts

**Test URL:** `/api/admin/books?search=java&sort=title&order=asc`

**Query Parameters:**
- `search` (optional) - Filter by title or ISBN
- `sort` (optional) - Sort field (default: "title")
- `order` (optional) - Sort order "asc" or "desc" (default: "asc")

**Expected Response:**
```json
[
  {
    "isbn": "9780134685991",
    "title": "Effective Java",
    "authors": ["Joshua Bloch"],
    "publisher": "Addison-Wesley Professional",
    "thumbnail_url": "...",
    "quantity_available": 10,
    "pending_requests_count": 2
  }
]
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `403 Forbidden` - User is not an admin (professor trying to access)
- `500 Internal Server Error` - Database query failed or RPC function doesn't exist

---

#### 5. GET /api/admin/requests
**Purpose:** Get all professor requests with optional filters

**Test URL:** `/api/admin/requests?status=pending&professor_email=user@example.com&isbn=9780134685991`

**Query Parameters:**
- `status` (optional) - Filter by status: "pending", "approved", "rejected", "partial"
- `professor_email` (optional) - Filter by professor email
- `isbn` (optional) - Filter by book ISBN

**Expected Response:**
```json
[
  {
    "id": "uuid",
    "professor_id": "uuid",
    "professor_email": "professor@university.edu",
    "isbn": "9780134685991",
    "book_title": "Effective Java",
    "book_authors": ["Joshua Bloch"],
    "book_thumbnail": "...",
    "quantity_requested": 3,
    "quantity_approved": null,
    "quantity_available": 10,
    "status": "pending",
    "rejection_reason": null,
    "requested_at": "2025-11-16T...",
    "processed_at": null,
    "processed_by": null
  }
]
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `403 Forbidden` - User is not an admin
- `500 Internal Server Error` - Database query failed

---

#### 6. POST /api/admin/requests/:id/approve
**Purpose:** Approve a pending request (full quantity)

**Test URL:** `/api/admin/requests/uuid-here/approve`

**Test Body:** `{}` (no body required)

**Expected Response:**
```json
{
  "success": true,
  "message": "Request approved for \"Effective Java\""
}
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `403 Forbidden` - User is not an admin
- `404 Not Found` - Request ID doesn't exist
- `400 Bad Request` - Request already processed (not pending)
- `400 Bad Request` - Insufficient inventory (quantity_available < quantity_requested)
- `500 Internal Server Error` - Failed to update request or inventory

**Side Effects:**
- Request status → "approved"
- Request quantity_approved → quantity_requested
- Book quantity_available → reduced by quantity_requested
- Request processed_at → current timestamp
- Request processed_by → admin user ID

---

#### 7. POST /api/admin/requests/:id/reject
**Purpose:** Reject a pending request

**Test URL:** `/api/admin/requests/uuid-here/reject`

**Test Body:**
```json
{
  "rejection_reason": "Book is out of print"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Request rejected for \"Effective Java\""
}
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `403 Forbidden` - User is not an admin
- `404 Not Found` - Request ID doesn't exist
- `400 Bad Request` - Request already processed (not pending)
- `500 Internal Server Error` - Failed to update request

**Side Effects:**
- Request status → "rejected"
- Request rejection_reason → provided reason (or null)
- Request processed_at → current timestamp
- Request processed_by → admin user ID
- Book quantity_available → unchanged

---

#### 8. POST /api/admin/requests/:id/partial
**Purpose:** Partially approve a request (less than requested quantity)

**Test URL:** `/api/admin/requests/uuid-here/partial`

**Test Body:**
```json
{
  "quantity_approved": 2
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Partially approved 2 of 3 for \"Effective Java\""
}
```

**Common Errors:**
- `401 Unauthorized` - User not logged in
- `403 Forbidden` - User is not an admin
- `404 Not Found` - Request ID doesn't exist
- `400 Bad Request` - Missing quantity_approved or quantity_approved < 1
- `400 Bad Request` - Request already processed (not pending)
- `400 Bad Request` - quantity_approved > quantity_requested
- `400 Bad Request` - Insufficient inventory (quantity_available < quantity_approved)
- `500 Internal Server Error` - Failed to update request or inventory

**Side Effects:**
- Request status → "partial"
- Request quantity_approved → provided quantity
- Book quantity_available → reduced by quantity_approved
- Request processed_at → current timestamp
- Request processed_by → admin user ID

---

## Testing Workflow

### Setup Test Data

1. **Add inventory to books:**
```sql
UPDATE books SET quantity_available = 10 WHERE isbn = '9780134685991';
```

2. **Create a test request as professor:**
- Log in as a professor
- POST to `/api/professor/request` with valid data

3. **Get the request ID:**
- GET `/api/professor/requests` or `/api/admin/requests`
- Copy the `id` field from the response

### Test Each Action

**Approve Flow:**
1. Create request → status "pending"
2. Approve request → status "approved", inventory reduced
3. Try to approve again → should fail (already approved)

**Reject Flow:**
1. Create request → status "pending"
2. Reject request → status "rejected", inventory unchanged
3. Try to reject again → should fail (already rejected)

**Partial Flow:**
1. Create request for 5 copies
2. Partially approve 2 copies → status "partial", inventory reduced by 2
3. Try to partial again → should fail (already processed)

---

## Common Error Scenarios

### Authentication Errors
- **Symptom:** Redirect to `/login` or 401 responses
- **Cause:** No active session or expired token
- **Fix:** Log in through OAuth flow

### Authorization Errors
- **Symptom:** 403 Forbidden
- **Cause:** Professor trying to access admin endpoints
- **Fix:** Log in with admin account (tonwyn47@gmail.com)

### Inventory Errors
- **Symptom:** "Insufficient inventory" message
- **Cause:** quantity_available < quantity_requested/approved
- **Fix:** Update book inventory: `UPDATE books SET quantity_available = 10 WHERE isbn = '...'`

### Request Already Processed
- **Symptom:** "Request already approved/rejected/partial"
- **Cause:** Trying to process a request that's not in "pending" status
- **Fix:** Create a new request for testing

### Book Not Found
- **Symptom:** 404 on book lookup or request submission
- **Cause:** ISBN doesn't exist in books table
- **Fix:** Use valid ISBNs: `9780134685991` or `9781305581982`

---

## Database State Checks

### Check current requests:
```sql
SELECT id, professor_email, isbn, quantity_requested, quantity_approved, status
FROM professor_requests
ORDER BY requested_at DESC;
```

### Check book inventory:
```sql
SELECT isbn, title, quantity_available
FROM books;
```

### Check pending requests per book:
```sql
SELECT
  b.isbn,
  b.title,
  b.quantity_available,
  COUNT(pr.id) FILTER (WHERE pr.status = 'pending') as pending_count
FROM books b
LEFT JOIN professor_requests pr ON b.isbn = pr.isbn
GROUP BY b.isbn, b.title, b.quantity_available;
```

### Reset a request to pending (for re-testing):
```sql
UPDATE professor_requests
SET
  status = 'pending',
  quantity_approved = NULL,
  processed_at = NULL,
  processed_by = NULL,
  rejection_reason = NULL
WHERE id = 'request-uuid-here';
```

---

## Quick Test Checklist

- [ ] Book lookup returns correct availability
- [ ] Professor can submit request when logged in
- [ ] Professor request history shows their requests only
- [ ] Admin can see all books with request counts
- [ ] Admin can see all requests with filters
- [ ] Approve reduces inventory correctly
- [ ] Reject doesn't change inventory
- [ ] Partial approval reduces inventory by approved amount
- [ ] Can't process same request twice
- [ ] Can't approve more than available inventory
- [ ] Professors can't access admin endpoints (403)
- [ ] Unauthenticated requests fail (401)
