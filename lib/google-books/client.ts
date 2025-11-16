/**
 * Google Books API client
 * Documentation: https://developers.google.com/books/docs/v1/reference/volumes
 */

interface GoogleBooksVolumeInfo {
  title?: string
  subtitle?: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  pageCount?: number
  categories?: string[]
  averageRating?: number
  ratingsCount?: number
  imageLinks?: {
    smallThumbnail?: string
    thumbnail?: string
  }
  language?: string
  industryIdentifiers?: Array<{
    type: string
    identifier: string
  }>
}

interface GoogleBooksVolume {
  id: string
  volumeInfo: GoogleBooksVolumeInfo
}

interface GoogleBooksResponse {
  kind: string
  totalItems: number
  items?: GoogleBooksVolume[]
}

export interface BookMetadata {
  google_books_id: string | null
  title: string
  subtitle: string | null
  authors: string[]
  publisher: string | null
  published_date: string | null
  description: string | null
  page_count: number | null
  categories: string[]
  language: string | null
  thumbnail_url: string | null
  small_thumbnail_url: string | null
  average_rating: number | null
  ratings_count: number | null
  metadata: object
}

const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes'

/**
 * Fetches book metadata from Google Books API by ISBN
 */
export async function fetchBookByISBN(isbn: string): Promise<BookMetadata | null> {
  try {
    // Build API URL
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    const url = new URL(GOOGLE_BOOKS_API_URL)
    url.searchParams.append('q', `isbn:${isbn}`)

    if (apiKey) {
      url.searchParams.append('key', apiKey)
    }

    // Fetch from Google Books API
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 24 hours
      next: { revalidate: 86400 }
    })

    if (!response.ok) {
      console.error(`Google Books API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data: GoogleBooksResponse = await response.json()

    // Check if book was found
    if (!data.items || data.items.length === 0 || data.totalItems === 0) {
      console.log(`No book found for ISBN: ${isbn}`)
      return null
    }

    // Extract first result (most relevant)
    const volume = data.items[0]
    const volumeInfo = volume.volumeInfo

    // Transform to our schema
    const bookMetadata: BookMetadata = {
      google_books_id: volume.id || null,
      title: volumeInfo.title || `Unknown Book (ISBN: ${isbn})`,
      subtitle: volumeInfo.subtitle || null,
      authors: volumeInfo.authors || [],
      publisher: volumeInfo.publisher || null,
      published_date: volumeInfo.publishedDate || null,
      description: volumeInfo.description || null,
      page_count: volumeInfo.pageCount || null,
      categories: volumeInfo.categories || [],
      language: volumeInfo.language || null,
      thumbnail_url: volumeInfo.imageLinks?.thumbnail || null,
      small_thumbnail_url: volumeInfo.imageLinks?.smallThumbnail || null,
      average_rating: volumeInfo.averageRating || null,
      ratings_count: volumeInfo.ratingsCount || null,
      metadata: data, // Store full API response
    }

    return bookMetadata
  } catch (error) {
    console.error('Error fetching from Google Books API:', error)
    return null
  }
}

/**
 * Creates a placeholder book metadata when API fails or book not found
 */
export function createPlaceholderBookMetadata(isbn: string, error?: string): BookMetadata {
  return {
    google_books_id: null,
    title: `Unknown Book (ISBN: ${isbn})`,
    subtitle: null,
    authors: [],
    publisher: null,
    published_date: null,
    description: null,
    page_count: null,
    categories: [],
    language: null,
    thumbnail_url: null,
    small_thumbnail_url: null,
    average_rating: null,
    ratings_count: null,
    metadata: {
      not_found_in_api: true,
      error: error || 'Book not found in Google Books API',
    },
  }
}
