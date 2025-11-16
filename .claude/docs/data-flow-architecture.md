# Nile System Data Flow Architecture

## Complete Data Flow: Scanner → Database → Webapp

This document explains how data flows through the Nile book inventory system, from the physical scanner device to the web application display.

---

## System Overview

```
┌─────────────────┐
│  iPhone Scanner │ (Physical Device)
│      App        │
└────────┬────────┘
         │ Scans ISBN Barcode
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│                     NETWORK LAYER                            │
│  POST /api/scan or Direct Supabase REST API                 │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE BACKEND                            │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │scanned_books │     │    books     │                      │
│  │   (Table)    │────▶│   (Table)    │                      │
│  └──────────────┘     └──────────────┘                      │
│         │                     │                              │
│         │                     └──────────────────┐           │
│         │                                        │           │
│         │              ┌──────────────────┐     │           │
│         │              │ book_embeddings  │◀────┘           │
│         │              │     (Future)     │                 │
│         │              └──────────────────┘                 │
│         │                                                    │
│         │              ┌──────────────────┐                 │
│         └─────────────▶│professor_requests│                 │
│                        │     (Table)      │                 │
│                        └──────────────────┘                 │
└────────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│              NEXT.JS WEBAPP (Vercel Hosted)                  │
│  ┌────────────────┐           ┌──────────────────┐          │
│  │ Admin Dashboard│           │Professor Request │          │
│  │   (Real-time)  │           │      Page        │          │
│  └────────────────┘           └──────────────────┘          │
│                                                              │
│  Deployment: https://nile-webapp.vercel.app                 │
│  Edge Functions: API routes run on Vercel Edge Network      │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Data Flow

### Phase 1: Scanning a Book

#### Current Implementation (Direct Supabase Access)

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: iPhone Scanner App Scans ISBN Barcode                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ISBN: "9781234567890"
                    Scanner ID: "iPhone_Library_Desk_1"
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Direct POST to Supabase REST API                        │
│                                                                  │
│ POST https://[project].supabase.co/rest/v1/scanned_books        │
│                                                                  │
│ Headers:                                                         │
│   - apikey: [anon_key]                                          │
│   - Authorization: Bearer [anon_key]                            │
│   - Content-Type: application/json                              │
│                                                                  │
│ Body:                                                            │
│   {                                                              │
│     "isbn": "9781234567890",                                    │
│     "scanner_id": "iPhone_Library_Desk_1",                      │
│     "scanned_at": "2025-01-16T12:34:56Z"                        │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Row Inserted into scanned_books Table                   │
│                                                                  │
│ scanned_books table:                                             │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ id (uuid)                                                     ││
│ │ isbn (text): "9781234567890"                                 ││
│ │ scanner_id (text): "iPhone_Library_Desk_1"                   ││
│ │ scanned_at (timestamptz): "2025-01-16T12:34:56Z"             ││
│ │ created_at (timestamptz): "2025-01-16T12:34:56Z"             ││
│ └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ⚠️ SYNC PROBLEM ⚠️
                              ↓
              books table NOT automatically updated
              (No trigger or background job exists)
```

#### Recommended Implementation (Via API Route)

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: iPhone Scanner App Scans ISBN Barcode                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: POST to Next.js API Route                               │
│                                                                  │
│ POST https://nile-webapp.vercel.app/api/scan                    │
│                                                                  │
│ Body:                                                            │
│   {                                                              │
│     "isbn": "9781234567890",                                    │
│     "scanner_id": "iPhone_Library_Desk_1"                       │
│   }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: API Route Processes Request (/api/scan/route.ts)        │
│                                                                  │
│ 3a. Normalize & Validate ISBN                                   │
│     - Remove hyphens/spaces                                     │
│     - Validate checksum                                         │
│                                                                  │
│ 3b. Insert into scanned_books table                             │
│     ✓ Creates scan record                                       │
│                                                                  │
│ 3c. Check if book exists in books table                         │
│     SELECT * FROM books WHERE isbn = '9781234567890'            │
│                                                                  │
│     IF NOT EXISTS:                                              │
│       3d. Fetch from Google Books API                           │
│           GET https://www.googleapis.com/books/v1/volumes       │
│               ?q=isbn:9781234567890                             │
│                                                                  │
│       3e. Insert into books table                               │
│           - title, authors, publisher, etc.                     │
│           - first_scanned_at = NOW()                            │
│           - scan_count = 1                                      │
│                                                                  │
│     IF EXISTS:                                                  │
│       3f. Update book statistics                                │
│           - last_scanned_at = NOW()                             │
│           - scan_count = scan_count + 1                         │
│                                                                  │
│ 3g. Return success response with book data                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         ✅ SYNCED ✅
                              ↓
              Both scanned_books AND books tables updated
```

---

## Database Schema & Relationships

### Table 1: scanned_books (Raw Scan Log)

**Purpose**: Immutable audit trail of every physical scan

```sql
CREATE TABLE scanned_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  isbn TEXT NOT NULL,
  scanner_id TEXT,
  scanned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Characteristics**:
- ✅ One row per scan (even duplicates)
- ✅ Never deleted or modified
- ✅ Used for analytics (scan frequency, scanner performance)
- ✅ Populated directly by scanner app
- ❌ No foreign key to books (can contain invalid ISBNs)

**Example Data**:
```
┌──────────────────────────────────────────────────────────────┐
│ 161 scans total                                               │
│ 6 unique ISBNs                                                │
│                                                               │
│ isbn "9781234567890" scanned 45 times                        │
│ isbn "9780987654321" scanned 38 times                        │
│ isbn "0038000265013" scanned 27 times (invalid UPC!)         │
│ isbn "http://doverpublications.com" scanned 12 times (URL!)  │
└──────────────────────────────────────────────────────────────┘
```

---

### Table 2: books (Master Book Catalog)

**Purpose**: Canonical source of truth for book inventory

```sql
CREATE TABLE books (
  isbn TEXT PRIMARY KEY,
  google_books_id TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  authors TEXT[],
  publisher TEXT,
  published_date TEXT,
  description TEXT,
  page_count INTEGER,
  categories TEXT[],
  language TEXT,
  thumbnail_url TEXT,
  small_thumbnail_url TEXT,
  average_rating NUMERIC,
  ratings_count INTEGER,
  quantity_available INTEGER DEFAULT 0,
  first_scanned_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  scan_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Characteristics**:
- ✅ One row per unique book (ISBN is primary key)
- ✅ Contains rich metadata from Google Books API
- ✅ Referenced by professor_requests (foreign key)
- ✅ Updated via API route (/api/scan)
- ✅ Used by web application for display

**Example Data**:
```
┌──────────────────────────────────────────────────────────────┐
│ 2 books total (should be 6!)                                  │
│                                                               │
│ ISBN: 9781234567890                                          │
│   Title: "Introduction to Algorithms"                        │
│   Authors: ["Cormen", "Leiserson", "Rivest", "Stein"]       │
│   Quantity: 5                                                │
│   Scan Count: 45                                             │
│                                                               │
│ ISBN: 9780987654321                                          │
│   Title: "Clean Code"                                        │
│   Authors: ["Robert Martin"]                                 │
│   Quantity: 0                                                │
│   Scan Count: 38                                             │
└──────────────────────────────────────────────────────────────┘
```

**❌ Missing Books**:
- 4 ISBNs from scanned_books have no corresponding books record
- Caused by scanner using direct Supabase access instead of API

---

### Table 3: professor_requests (Book Requests)

**Purpose**: Track professor book requests and approvals

```sql
CREATE TABLE professor_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professor_id UUID REFERENCES auth.users(id),
  professor_email TEXT NOT NULL,
  isbn TEXT REFERENCES books(isbn), -- ⚠️ FOREIGN KEY!
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
  rejection_reason TEXT,
  course_code TEXT,
  course_name TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Characteristics**:
- ✅ References books table via foreign key
- ✅ Cannot request a book that doesn't exist in books table
- ✅ Used by professor request page
- ✅ Displayed in admin dashboard

---

### Table 4: book_embeddings (Future RAG Implementation)

**Purpose**: Vector embeddings for semantic search and chatbot

```sql
CREATE TABLE book_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_isbn TEXT REFERENCES books(isbn) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- pgvector extension
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Characteristics**:
- ⏳ Not yet implemented
- ✅ Will enable AI chatbot for inventory questions
- ✅ Auto-updated when books are added/modified
- ✅ Uses pgvector for similarity search

---

## Syncing Problem Analysis

### Current State

```
Scanner App → scanned_books ✅ (Direct Insert)
                   ↓
                   ❌ NO SYNC
                   ↓
               books ❌ (Not Updated)
```

**Result**:
- ✅ 161 scans recorded in scanned_books
- ❌ Only 2 books in books table (should be 6)
- ❌ 4 ISBNs have no metadata
- ❌ Professor requests cannot be created for missing books (foreign key constraint)

### Root Cause

The scanner app is using **direct Supabase REST API** access:

```
POST https://[project].supabase.co/rest/v1/scanned_books
```

This bypasses the Next.js API route (`/api/scan/route.ts`) which contains the logic to:
1. Validate ISBN
2. Fetch Google Books metadata
3. Populate the books table
4. Update statistics

---

## Solution: Proper Data Flow

### Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        SCANNER APP                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. Scan barcode                                             │  │
│  │ 2. Validate format (basic ISBN check)                      │  │
│  │ 3. POST to /api/scan (NOT direct Supabase)                 │  │
│  │ 4. Display result to user                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         │ HTTPS POST
                         │
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTE                              │
│                    /api/scan/route.ts                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. Normalize ISBN (remove hyphens, spaces)                 │  │
│  │ 2. Validate ISBN (checksum verification)                   │  │
│  │ 3. Insert into scanned_books ────────────────────┐         │  │
│  │ 4. Check if book exists in books table           │         │  │
│  │    - If NO: Fetch from Google Books API          │         │  │
│  │             Insert into books table              │         │  │
│  │    - If YES: Update scan_count, last_scanned_at  │         │  │
│  │ 5. Return book data to scanner                   │         │  │
│  └──────────────────────────────────────────────────┼─────────┘  │
└─────────────────────────────────────────────────────┼─────────────┘
                                                      │
                         ┌────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                              │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │ scanned_books    │         │     books        │              │
│  │                  │         │                  │              │
│  │ ✓ Every scan     │◀────────│ ✓ Unique books  │              │
│  │ ✓ Audit trail    │         │ ✓ Metadata      │              │
│  │ ✓ Raw data       │         │ ✓ Inventory     │              │
│  └──────────────────┘         └────────┬─────────┘              │
│                                         │                        │
│                                         │ FK Reference           │
│                                         ↓                        │
│                               ┌──────────────────┐               │
│                               │professor_requests│               │
│                               │                  │               │
│                               │ ✓ Book requests  │               │
│                               │ ✓ Approvals      │               │
│                               └──────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
                         │
                         │ Supabase Realtime
                         │
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                       WEB APPLICATION                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Admin Dashboard                                             │  │
│  │   - View all books (from books table)                      │  │
│  │   - See pending requests (from professor_requests)         │  │
│  │   - Check inventory levels (quantity_available)            │  │
│  │   - Monitor scan activity (scan_count, last_scanned_at)    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Professor Request Page                                      │  │
│  │   - Search books (from books table)                        │  │
│  │   - Submit requests (to professor_requests)                │  │
│  │   - View request history                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Alternative Solution: Database Trigger (Not Recommended)

If changing the scanner app is difficult, you could implement a database trigger:

```sql
-- NOT RECOMMENDED: Adds complexity and couples database to external API

CREATE OR REPLACE FUNCTION sync_book_on_scan()
RETURNS TRIGGER AS $$
DECLARE
  book_exists BOOLEAN;
BEGIN
  -- Check if book exists
  SELECT EXISTS(SELECT 1 FROM books WHERE isbn = NEW.isbn)
  INTO book_exists;

  IF NOT book_exists THEN
    -- Call Edge Function to fetch and insert book
    -- (Requires pg_net extension and Edge Function setup)
    PERFORM net.http_post(
      url := 'https://your-edge-function-url/sync-book',
      body := json_build_object('isbn', NEW.isbn)::text
    );
  ELSE
    -- Update scan statistics
    UPDATE books
    SET
      last_scanned_at = NEW.scanned_at,
      scan_count = scan_count + 1
    WHERE isbn = NEW.isbn;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_book_on_scan
  AFTER INSERT ON scanned_books
  FOR EACH ROW
  EXECUTE FUNCTION sync_book_on_scan();
```

**Why Not Recommended**:
- ❌ Requires Edge Function deployment
- ❌ Harder to debug and test
- ❌ Database coupled to external APIs
- ❌ Rate limiting issues with Google Books API
- ❌ Error handling is complex
- ✅ Scanner app doesn't need to change

**Better Approach**: Update scanner app to use `/api/scan` endpoint

---

## Data Flow Summary

### Current (Broken) Flow
```
Scanner → Supabase REST → scanned_books ✅
                              ↓
                          NO SYNC ❌
                              ↓
                          books table (empty) ❌
```

### Recommended Flow
```
Scanner → Next.js API → scanned_books ✅
                            ↓
                    Google Books API ✅
                            ↓
                        books table ✅
                            ↓
                        Web App ✅
```

---

## Benefits of Proper Implementation

### ✅ Data Consistency
- Every scan creates both a scan record AND book metadata
- No missing books in the catalog
- Professors can request any scanned book

### ✅ Better Validation
- Invalid ISBNs rejected before database insert
- UPC barcodes detected and rejected
- URLs and malformed data filtered out

### ✅ Audit Trail
- scanned_books: When and where books were scanned
- books: What metadata was fetched and when
- Full traceability from scan to request

### ✅ Scalability
- API route can be rate-limited
- Google Books API calls are centralized
- Can add caching layer easily
- Can implement retry logic

### ✅ Future Features
- Auto-generate embeddings when books are added
- Trigger notifications on new books
- Analytics on scan patterns
- Automatic reordering for low stock

---

## Migration Path

### Step 1: Update Scanner App Code
Change from:
```swift
// ❌ Current (direct Supabase)
supabase.from("scanned_books").insert(...)
```

To:
```swift
// ✅ Recommended (via API)
let response = await fetch("https://nile-webapp.vercel.app/api/scan", {
  method: "POST",
  body: JSON.stringify({ isbn: scannedISBN, scanner_id: deviceID })
})
```

### Step 2: Backfill Missing Books
Run a script to process existing scans:

```typescript
// scripts/backfill-books.ts
const { data: scans } = await supabase
  .from('scanned_books')
  .select('isbn')
  .not('isbn', 'in', (
    supabase.from('books').select('isbn')
  ))

for (const scan of scans) {
  await fetch('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ isbn: scan.isbn })
  })
}
```

### Step 3: Monitor & Verify
- Check that scanned_books and books counts match
- Verify no more missing books
- Test professor request flow

---

## Key Takeaways

1. **Scanner → API → Database** (not Scanner → Database directly)
2. **scanned_books** = Raw audit trail (all scans)
3. **books** = Master catalog (unique books with metadata)
4. **Sync happens in API route**, not database trigger
5. **Foreign keys** require books to exist before requests can be made

---

## Next Steps

1. ✅ Created scanner API specification (scanner-app-api-spec.md)
2. ⏳ Update scanner app to use `/api/scan` endpoint
3. ⏳ Run backfill script for missing books
4. ⏳ Implement automatic embedding generation (for RAG chatbot)
5. ⏳ Add monitoring for sync failures
