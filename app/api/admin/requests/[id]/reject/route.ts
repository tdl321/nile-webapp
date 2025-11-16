import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // Parse request body for optional rejection reason
    const body = await request.json()
    const { rejection_reason } = body

    // Get the request details
    const { data: requestData, error: fetchError } = await supabase
      .from('professor_requests')
      .select('id, status, books(title)')
      .eq('id', id)
      .single()

    if (fetchError || !requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Check if request is already processed
    if (requestData.status !== 'pending') {
      return NextResponse.json(
        { error: `Request already ${requestData.status}` },
        { status: 400 }
      )
    }

    // Extract book data
    const bookData = Array.isArray(requestData.books) ? requestData.books[0] : requestData.books

    // Update request to rejected
    const { error: updateError } = await supabase
      .from('professor_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejection_reason || null,
        processed_at: new Date().toISOString(),
        processed_by: user.id
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error rejecting request:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Request rejected for "${bookData?.title}"`
    })

  } catch (error) {
    console.error('Unexpected error rejecting request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
