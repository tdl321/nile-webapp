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

    // Verify user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const professorEmail = searchParams.get('professor_email')
    const isbn = searchParams.get('isbn')

    // Build query
    let query = supabase
      .from('professor_requests')
      .select(`
        id,
        professor_id,
        professor_email,
        isbn,
        quantity_requested,
        quantity_approved,
        status,
        rejection_reason,
        requested_at,
        processed_at,
        processed_by,
        books (
          title,
          authors,
          thumbnail_url,
          quantity_available
        )
      `)
      .order('requested_at', { ascending: false })

    // Apply filters if provided
    if (status) {
      query = query.eq('status', status)
    }
    if (professorEmail) {
      query = query.eq('professor_email', professorEmail)
    }
    if (isbn) {
      query = query.eq('isbn', isbn)
    }

    const { data: requests, error } = await query

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
        professor_id: req.professor_id,
        professor_email: req.professor_email,
        isbn: req.isbn,
        book_title: bookData?.title || 'Unknown Book',
        book_authors: bookData?.authors || [],
        book_thumbnail: bookData?.thumbnail_url,
        quantity_requested: req.quantity_requested,
        quantity_approved: req.quantity_approved,
        quantity_available: bookData?.quantity_available || 0,
        status: req.status,
        rejection_reason: req.rejection_reason,
        requested_at: req.requested_at,
        processed_at: req.processed_at,
        processed_by: req.processed_by
      }
    })

    return NextResponse.json(formattedRequests)

  } catch (error) {
    console.error('Unexpected error fetching admin requests:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
