'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface BookData {
  isbn: string
  title: string
  authors: string[]
  publisher: string
  thumbnail_url: string
  quantity_available: number
}

export function RequestForm() {
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(false)
  const form = useForm({
    defaultValues: {
      isbn: '',
      quantity: 1
    }
  })

  const handleIsbnChange = async (isbn: string) => {
    if (isbn.length >= 10) {
      setLoading(true)
      try {
        const response = await fetch(`/api/books/${isbn}`)
        if (response.ok) {
          const data = await response.json()
          setBookData(data)
        } else {
          setBookData(null)
          toast.error('Book not found')
        }
      } catch (error) {
        setBookData(null)
        toast.error('Failed to fetch book data')
      } finally {
        setLoading(false)
      }
    } else {
      setBookData(null)
    }
  }

  const onSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/professor/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isbn: data.isbn,
          quantity_requested: data.quantity
        })
      })

      if (response.ok) {
        toast.success('Request submitted successfully!')
        form.reset()
        setBookData(null)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to submit request')
      }
    } catch (error) {
      toast.error('An error occurred while submitting the request')
    }
  }

  const getStockBadgeVariant = (quantity: number) => {
    if (quantity === 0) return 'destructive'
    if (quantity <= 4) return 'secondary'
    return 'default'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Request a Book</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="isbn"
              rules={{
                required: 'ISBN is required',
                minLength: { value: 10, message: 'ISBN must be at least 10 characters' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ISBN Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        handleIsbnChange(e.target.value)
                      }}
                      placeholder="9780140328721"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {loading && <Skeleton className="h-32 w-full" />}

            {bookData && !loading && (
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{bookData.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    by {bookData.authors.join(', ')}
                  </p>
                  <p className="text-sm text-muted-foreground">{bookData.publisher}</p>
                  <div className="pt-2">
                    <Badge variant={getStockBadgeVariant(bookData.quantity_available)}>
                      {bookData.quantity_available > 0
                        ? `${bookData.quantity_available} ${bookData.quantity_available === 1 ? 'copy' : 'copies'} available`
                        : 'Out of stock'}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            <FormField
              control={form.control}
              name="quantity"
              rules={{
                required: 'Quantity is required',
                min: { value: 1, message: 'Quantity must be at least 1' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Needed</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="1"
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={!bookData}>
              Submit Request
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
