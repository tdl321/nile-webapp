import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const { isbn, quantity_requested, course_code, course_name } = body

    // Validate input
    if (!isbn || !quantity_requested || quantity_requested < 1) {
      return NextResponse.json(
        { error: 'Invalid request: ISBN and quantity (>0) required' },
        { status: 400 }
      )
    }

    // Verify book exists
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('isbn, title')
      .eq('isbn', isbn)
      .single()

    if (bookError || !book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }

    // Insert professor request
    const { data: request_data, error: insertError } = await supabase
      .from('professor_requests')
      .insert({
        professor_id: user.id,
        professor_email: user.email,
        isbn: isbn,
        quantity_requested: quantity_requested,
        course_code: course_code || null,
        course_name: course_name || null,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating request:', insertError)
      return NextResponse.json(
        { error: 'Failed to create request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      request_id: request_data.id,
      message: `Request submitted for "${book.title}"`
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in professor request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
