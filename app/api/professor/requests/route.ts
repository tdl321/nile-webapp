import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch professor's requests with book details (joined)
    const { data: requests, error } = await supabase
      .from('professor_requests')
      .select(`
        id,
        isbn,
        quantity_requested,
        quantity_approved,
        status,
        rejection_reason,
        requested_at,
        processed_at,
        course_code,
        course_name,
        books (
          title,
          authors,
          thumbnail_url
        )
      `)
      .eq('professor_id', user.id)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error fetching requests:', error)
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      )
    }

    // Format the response
    const formattedRequests = requests.map(req => {
      const bookData = Array.isArray(req.books) ? req.books[0] : req.books
      return {
        id: req.id,
        isbn: req.isbn,
        book_title: bookData?.title || 'Unknown Book',
        book_authors: bookData?.authors || [],
        book_thumbnail: bookData?.thumbnail_url,
        quantity_requested: req.quantity_requested,
        quantity_approved: req.quantity_approved,
        status: req.status,
        rejection_reason: req.rejection_reason,
        requested_at: req.requested_at,
        processed_at: req.processed_at,
        course_code: req.course_code,
        course_name: req.course_name
      }
    })

    return NextResponse.json(formattedRequests)

  } catch (error) {
    console.error('Unexpected error fetching professor requests:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
