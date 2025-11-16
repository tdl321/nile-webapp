# Backend Architecture & Data Flow

## Overview
This document outlines the complete data flow and architecture for the ISBN scanner analytics web app using Next.js, Supabase, and the Google Books API.

## Complete Data Flow

```
┌─────────────┐
│   Scanner   │ (Physical device or mobile app)
└──────┬──────┘
       │ 1. Scans ISBN barcode
       │    (e.g., "9780140328721")
       ▼
┌─────────────────────────────────────────────────────────┐
│              POST /api/scan                              │
│         (Next.js API Route)                              │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Step 1: Validate ISBN                          │    │
│  │ - Check format (10 or 13 digits)               │    │
│  │ - Sanitize input                               │    │
│  └────────────────────────────────────────────────┘    │
│                        │                                │
│                        ▼                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ Step 2: Insert into `scans` table              │    │
│  │ - Create scan record immediately               │    │
│  │ - Record timestamp, scanner_id, etc.           │    │
│  └────────────────────────────────────────────────┘    │
│                        │                                │
│                        ▼                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ Step 3: Check if book exists in `books` table  │    │
│  │ - Query: SELECT * FROM books WHERE isbn = ?   │    │
│  └────────────────────────────────────────────────┘    │
│                        │                                │
│           ┌────────────┴─────────────┐                 │
│           ▼                          ▼                 │
│    ┌─────────────┐          ┌──────────────┐          │
│    │ Book EXISTS │          │ Book NOT     │          │
│    │             │          │ found        │          │
│    └──────┬──────┘          └──────┬───────┘          │
│           │                        │                   │
│           │                        ▼                   │
│           │              ┌──────────────────────────┐  │
│           │              │ Step 4: Fetch from       │  │
│           │              │ Google Books API         │  │
│           │              │                          │  │
│           │              │ GET https://www.google   │  │
│           │              │ apis.com/books/v1/       │  │
│           │              │ volumes?q=isbn:xxx       │  │
│           │              └──────────┬───────────────┘  │
│           │                         │                  │
│           │                         ▼                  │
│           │              ┌──────────────────────────┐  │
│           │              │ Step 5: Parse API        │  │
│           │              │ response & extract:      │  │
│           │              │ - title                  │  │
│           │              │ - author(s)              │  │
│           │              │ - publisher              │  │
│           │              │ - cover image            │  │
│           │              │ - publication year       │  │
│           │              └──────────┬───────────────┘  │
│           │                         │                  │
│           │                         ▼                  │
│           │              ┌──────────────────────────┐  │
│           │              │ Step 6: Insert book data │  │
│           │              │ into `books` table       │  │
│           │              └──────────┬───────────────┘  │
│           │                         │                  │
│           └─────────────────────────┘                  │
│                        │                                │
│                        ▼                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ Step 7: Update book stats                      │    │
│  │ - Increment scan_count                         │    │
│  │ - Update last_scanned_at                       │    │
│  └────────────────────────────────────────────────┘    │
│                        │                                │
│                        ▼                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ Step 8: Return response to scanner             │    │
│  │ - Success status                               │    │
│  │ - Book data (for scanner display, optional)    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  Supabase DB     │
              │                  │
              │  ┌────────────┐  │
              │  │   scans    │  │
              │  └────────────┘  │
              │  ┌────────────┐  │
              │  │   books    │  │
              │  └────────────┘  │
              └──────────────────┘
```

## Architecture Components

### 1. Scanner (Input Device)
- Physical barcode scanner OR
- Mobile app with camera OR
- Manual ISBN entry form

**Sends HTTP POST request:**
```http
POST https://your-app.vercel.app/api/scan
Content-Type: application/json

{
  "isbn": "9780140328721",
  "scanner_id": "scanner_01"
}
```

### 2. Next.js API Route (`/app/api/scan/route.ts`)

This is the orchestrator that handles all the logic:

```typescript
// Pseudocode structure
export async function POST(request: Request) {
  // 1. Parse request
  const { isbn, scanner_id } = await request.json()

  // 2. Validate ISBN
  if (!isValidISBN(isbn)) return error

  // 3. Insert scan record (ALWAYS happens, fast)
  await supabase.from('scans').insert({
    isbn,
    scanner_id,
    scanned_at: new Date()
  })

  // 4. Check if book exists
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('isbn', isbn)
    .single()

  // 5. If book doesn't exist, fetch from Google Books API
  if (!book) {
    const bookData = await fetchFromGoogleBooks(isbn)

    // 6. Store book data
    await supabase.from('books').insert({
      isbn,
      title: bookData.title,
      author: bookData.author,
      cover_image_url: bookData.cover,
      ...
    })
  }

  // 7. Update book stats
  await supabase.from('books')
    .update({
      scan_count: book.scan_count + 1,
      last_scanned_at: new Date()
    })
    .eq('isbn', isbn)

  // 8. Return success
  return Response.json({ success: true, book })
}
```

### 3. Google Books API

**API Endpoint:**
```
https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
```

**Example Request:**
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:9780140328721
```

**Example Response:**
```json
{
  "kind": "books#volumes",
  "totalItems": 1,
  "items": [
    {
      "id": "jEUOAAAAQAAJ",
      "volumeInfo": {
        "title": "The Odyssey",
        "authors": ["Homer"],
        "publisher": "Penguin Classics",
        "publishedDate": "1991",
        "description": "The epic tale of Odysseus and his journey home...",
        "industryIdentifiers": [
          {
            "type": "ISBN_13",
            "identifier": "9780140328721"
          }
        ],
        "pageCount": 324,
        "categories": ["Fiction"],
        "imageLinks": {
          "smallThumbnail": "http://books.google.com/books/content?id=xxx&printsec=frontcover&img=1&zoom=5",
          "thumbnail": "http://books.google.com/books/content?id=xxx&printsec=frontcover&img=1&zoom=1"
        },
        "language": "en"
      }
    }
  ]
}
```

**What you extract:**
- `items[0].volumeInfo.title` → Store in books.title
- `items[0].volumeInfo.authors[0]` → Store in books.author (or join multiple)
- `items[0].volumeInfo.publisher` → Store in books.publisher
- `items[0].volumeInfo.publishedDate` → Extract year, store in books.publication_year
- `items[0].volumeInfo.imageLinks.thumbnail` → Store in books.cover_image_url

**API Key:**
- Google Books API is free but requires an API key for higher rate limits
- Get key from: https://console.cloud.google.com/apis/credentials
- Optional: Can use without key (limited to 1000 requests/day)
- With key: Store in environment variable `GOOGLE_BOOKS_API_KEY`

### 4. Supabase Database

**Tables:**

```sql
-- scans table (event log)
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanner_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scans_isbn ON scans(isbn);
CREATE INDEX idx_scans_scanned_at ON scans(scanned_at DESC);

-- books table (metadata cache)
CREATE TABLE books (
  isbn TEXT PRIMARY KEY,
  title TEXT,
  author TEXT,
  publisher TEXT,
  publication_year INTEGER,
  cover_image_url TEXT,
  metadata JSONB, -- store full API response
  first_scanned_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  scan_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Dashboard (Next.js App)

Server Components fetch data for display:

```typescript
// app/dashboard/page.tsx
export default async function Dashboard() {
  // Fetch recent scans
  const { data: recentScans } = await supabase
    .from('scans')
    .select('*, books(*)')  // Join with books table
    .order('scanned_at', { ascending: false })
    .limit(10)

  // Fetch top books
  const { data: topBooks } = await supabase
    .from('books')
    .select('*')
    .order('scan_count', { ascending: false })
    .limit(10)

  return (
    <div>
      <RecentScans scans={recentScans} />
      <TopBooks books={topBooks} />
      <Charts ... />
    </div>
  )
}
```

## Detailed Sequence Diagram

```
Scanner          API Route         Supabase DB      Google Books API
   │                 │                  │                  │
   │  POST /api/scan │                  │                  │
   │────────────────>│                  │                  │
   │                 │                  │                  │
   │                 │ INSERT INTO scans│                  │
   │                 │─────────────────>│                  │
   │                 │                  │                  │
   │                 │ SELECT FROM books│                  │
   │                 │─────────────────>│                  │
   │                 │<─────────────────│                  │
   │                 │  (book not found)│                  │
   │                 │                  │                  │
   │                 │      GET /volumes?q=isbn:xxx        │
   │                 │─────────────────────────────────────>│
   │                 │<─────────────────────────────────────│
   │                 │           (book metadata)            │
   │                 │                  │                  │
   │                 │ INSERT INTO books│                  │
   │                 │─────────────────>│                  │
   │                 │                  │                  │
   │                 │ UPDATE books     │                  │
   │                 │ SET scan_count++ │                  │
   │                 │─────────────────>│                  │
   │                 │                  │                  │
   │<────────────────│                  │                  │
   │  200 OK         │                  │                  │
   │  {success:true} │                  │                  │
```

## Error Handling Strategy

### Scenario 1: Google Books API is down
```typescript
try {
  bookData = await fetchFromGoogleBooks(isbn)
} catch (error) {
  // Still save the scan, but book data is minimal
  await supabase.from('books').insert({
    isbn,
    title: 'Unknown (ISBN: ' + isbn + ')',
    author: null,
    metadata: { fetch_failed: true }
  })
}
```

### Scenario 2: ISBN not found in Google Books
```typescript
if (!googleBooksResponse || googleBooksResponse.totalItems === 0) {
  // Store ISBN with placeholder
  await supabase.from('books').insert({
    isbn,
    title: 'Unknown Book',
    author: 'Unknown',
    metadata: { not_found_in_api: true }
  })
}
```

### Scenario 3: Database error
```typescript
try {
  await supabase.from('scans').insert(...)
} catch (error) {
  // Log error, return 500
  return Response.json({
    error: 'Database error',
    message: error.message
  }, { status: 500 })
}
```

## Performance Considerations

### Why this architecture is efficient:

1. **Fast scan recording**
   - `INSERT INTO scans` happens immediately
   - Scanner gets quick response
   - No waiting for external API

2. **Cached book data**
   - First scan: API call needed (~200-500ms)
   - Subsequent scans: Data already in DB (~10ms)
   - 95%+ of scans will be cache hits after initial population

3. **Asynchronous enrichment (optional optimization)**
   ```typescript
   // Record scan immediately
   await insertScan()

   // Fetch book data in background (don't await)
   enrichBookData(isbn).catch(err => log(err))

   // Return success immediately
   return success
   ```

## Analytics Queries You Can Run

With this schema, you can answer:

### Basic Analytics:
- Total scans today/week/month
- Scans per hour (time patterns)
- Most scanned books
- Recent scans

### Advanced Analytics:
- Scans by author/category
- Books scanned only once vs multiple times
- Scanner performance (which scanner is most active)
- Location comparison (if you add location tracking)

## Open Questions

1. **Scanner Response Time:** Does the scanner need to wait for book data, or can it just confirm "scan recorded"?

2. **Fallback APIs:** If Google Books doesn't have the book, should we try Open Library API as backup?

3. **Manual Override:** Should you be able to manually edit book data in the dashboard if API data is wrong?

4. **Bulk Import:** Do you need to import existing inventory, or start fresh?

5. **Real-time Dashboard:** Should the dashboard update live as scans happen, or is periodic refresh okay?
