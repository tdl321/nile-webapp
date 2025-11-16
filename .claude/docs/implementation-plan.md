# Implementation Plan: ISBN Scanner Backend

## Overview
Complete implementation plan for the ISBN scanner analytics web app backend, including Supabase schema design and Next.js API endpoint creation.

## Phase 1: Create `books` Table in Supabase

### Schema Design

Create a new table to store book metadata fetched from Google Books API:

**Table: `books`**
```sql
CREATE TABLE books (
  -- Primary key
  isbn TEXT PRIMARY KEY,

  -- Core metadata from Google Books API
  google_books_id TEXT,           -- volumeInfo.id
  title TEXT,                      -- volumeInfo.title
  subtitle TEXT,                   -- volumeInfo.subtitle
  authors TEXT[],                  -- volumeInfo.authors (array)
  publisher TEXT,                  -- volumeInfo.publisher
  published_date TEXT,             -- volumeInfo.publishedDate
  description TEXT,                -- volumeInfo.description (HTML)
  page_count INTEGER,              -- volumeInfo.pageCount
  categories TEXT[],               -- volumeInfo.categories (array)
  language TEXT,                   -- volumeInfo.language

  -- Images
  thumbnail_url TEXT,              -- volumeInfo.imageLinks.thumbnail
  small_thumbnail_url TEXT,        -- volumeInfo.imageLinks.smallThumbnail

  -- Ratings
  average_rating DECIMAL(2,1),    -- volumeInfo.averageRating
  ratings_count INTEGER,           -- volumeInfo.ratingsCount

  -- Analytics fields
  first_scanned_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  scan_count INTEGER DEFAULT 0,

  -- Full API response for future reference
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_authors ON books USING GIN(authors);
CREATE INDEX idx_books_categories ON books USING GIN(categories);
CREATE INDEX idx_books_scan_count ON books(scan_count DESC);

-- RLS policies
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
  ON books FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert/update"
  ON books FOR ALL
  TO service_role
  USING (true);
```

### Google Books API Response Mapping

**API Endpoint:** `GET https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}`

**Response Structure:**
```typescript
{
  kind: "books#volumes",
  totalItems: number,
  items: [
    {
      id: string,                    → google_books_id
      volumeInfo: {
        title: string,               → title
        subtitle?: string,           → subtitle
        authors: string[],           → authors
        publisher: string,           → publisher
        publishedDate: string,       → published_date
        description: string,         → description (HTML formatted)
        pageCount: number,           → page_count
        categories: string[],        → categories
        averageRating: number,       → average_rating (1.0 to 5.0)
        ratingsCount: number,        → ratings_count
        imageLinks: {
          smallThumbnail: string,    → small_thumbnail_url
          thumbnail: string          → thumbnail_url
        },
        language: string,            → language
        industryIdentifiers: [
          {
            type: "ISBN_10" | "ISBN_13",
            identifier: string
          }
        ]
      }
    }
  ]
}
```

## Phase 2: Create API Endpoint `/api/scan/route.ts`

### File Structure

```
app/
  api/
    scan/
      route.ts          # Main API endpoint
lib/
  supabase/
    client.ts           # Supabase client setup
    server.ts           # Server-side Supabase client
  google-books/
    client.ts           # Google Books API functions
  utils/
    isbn-validator.ts   # ISBN validation utility
```

### API Endpoint Logic Flow

**Endpoint:** `POST /api/scan`

**Request Body:**
```json
{
  "isbn": "9780140328721",
  "scanner_id": "scanner_01"
}
```

**Processing Steps:**

1. **Validate ISBN** - Check format (10 or 13 digits)
2. **Insert Scan Record** - Add to `scanned_books` table immediately
3. **Check Book Exists** - Query `books` table by ISBN
4. **If Book Not Found:**
   - Fetch from Google Books API
   - Parse response
   - Insert into `books` table
5. **Update Book Stats** - Increment `scan_count`, update `last_scanned_at`
6. **Return Response** - Success with book data

**Response:**
```json
{
  "success": true,
  "scan_id": "uuid",
  "book": {
    "isbn": "9780140328721",
    "title": "The Odyssey",
    "authors": ["Homer"],
    "thumbnail_url": "https://...",
    ...
  }
}
```

### Error Handling Scenarios

1. **Invalid ISBN Format**
   ```json
   {
     "success": false,
     "error": "Invalid ISBN format",
     "code": "INVALID_ISBN"
   }
   ```

2. **Book Not Found in Google Books**
   - Still insert scan record
   - Create placeholder book entry
   ```typescript
   {
     isbn,
     title: `Unknown Book (ISBN: ${isbn})`,
     authors: [],
     metadata: { not_found_in_api: true }
   }
   ```

3. **Google Books API Down**
   - Still insert scan record
   - Create placeholder book entry
   ```typescript
   {
     isbn,
     title: `Unknown Book (ISBN: ${isbn})`,
     authors: [],
     metadata: { fetch_failed: true, error: error.message }
   }
   ```

4. **Database Error**
   ```json
   {
     "success": false,
     "error": "Database error",
     "code": "DB_ERROR"
   }
   ```

## Phase 3: Environment Setup

### Environment Variables

Add to `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Books API (optional but recommended for higher rate limits)
GOOGLE_BOOKS_API_KEY=your-api-key
```

### Getting Google Books API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Enable "Books API"
4. Create credentials → API Key
5. Restrict key to Books API only (recommended)

**Rate Limits:**
- Without API key: 1,000 requests/day
- With API key: Higher limits (check your quota)

## Phase 4: Implementation Details

### Key Implementation Considerations

1. **Published Date Parsing**
   - Can be `"YYYY"` or `"YYYY-MM-DD"`
   - Store as-is in `published_date` field
   - Extract year when needed for analytics

2. **Authors Array Handling**
   - Store as PostgreSQL TEXT[] array
   - Join with commas for display: `authors.join(', ')`

3. **Description Field**
   - Contains HTML formatting (b, i, br tags)
   - Sanitize before displaying in frontend
   - Store raw HTML in database

4. **Thumbnail URLs**
   - Google Books provides both small and regular thumbnails
   - Store both for flexibility
   - Handle missing image cases

5. **Scan Count Updates**
   - Use atomic increment to avoid race conditions
   - Update `last_scanned_at` on every scan
   - Set `first_scanned_at` only on first insert

## Phase 5: Testing Plan

### Test Cases

1. **Valid ISBN (exists in Google Books)**
   - Input: `9780140328721` (The Odyssey)
   - Expected: Scan recorded, book metadata fetched and stored

2. **Invalid ISBN Format**
   - Input: `invalid123`
   - Expected: 400 error, no database records created

3. **ISBN Not Found in Google Books**
   - Input: `9999999999999`
   - Expected: Scan recorded, placeholder book entry created

4. **Duplicate Scans**
   - Input: Same ISBN scanned multiple times
   - Expected: Multiple scan records, book `scan_count` incremented

5. **Google Books API Failure**
   - Scenario: API returns 500 error
   - Expected: Scan recorded, placeholder book with error metadata

6. **Database Connection Failure**
   - Scenario: Supabase unreachable
   - Expected: 500 error returned to scanner

### Manual Testing Steps

```bash
# Test valid ISBN
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"isbn":"9780140328721","scanner_id":"test_scanner"}'

# Test invalid ISBN
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"isbn":"invalid","scanner_id":"test_scanner"}'

# Test duplicate scan
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"isbn":"9780140328721","scanner_id":"test_scanner"}'
```

## Files to Create/Modify

### New Files
1. **Migration file** - `supabase/migrations/YYYYMMDD_create_books_table.sql`
2. **`/app/api/scan/route.ts`** - Main API endpoint
3. **`/lib/supabase/server.ts`** - Server-side Supabase client
4. **`/lib/google-books/client.ts`** - Google Books API integration
5. **`/lib/utils/isbn-validator.ts`** - ISBN validation utility
6. **`.claude/docs/api-contract.md`** - API documentation

### Modified Files
1. **`.env.local`** - Add environment variables
2. **`.claude/docs/backend.md`** - Update with final implementation details

## Next Steps After Implementation

1. **Create Dashboard Components**
   - Recent scans list
   - Top books chart
   - Scan frequency graph
   - Book details modal

2. **Add Real-time Features**
   - Supabase real-time subscriptions
   - Live dashboard updates when new scans occur

3. **Implement Analytics Queries**
   - Scans per day/week/month
   - Most popular books
   - Scanner performance metrics
   - Category analysis

4. **Deploy to Production**
   - Deploy Next.js app to Vercel
   - Configure production environment variables
   - Test with production Supabase instance
   - Monitor API performance and errors

## Success Criteria

- [ ] `books` table created in Supabase with all fields
- [ ] RLS policies configured correctly
- [ ] `/api/scan` endpoint successfully receives ISBN
- [ ] Scan records inserted into `scanned_books` table
- [ ] Google Books API integration working
- [ ] Book metadata stored in `books` table
- [ ] Duplicate scans handled correctly (scan_count increments)
- [ ] Error cases handled gracefully
- [ ] Environment variables configured
- [ ] All test cases pass
