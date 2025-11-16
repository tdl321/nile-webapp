'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Search, Book, Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface BookData {
  isbn: string
  title: string
  subtitle?: string
  authors: string[]
  publisher: string
  thumbnail_url: string
  quantity_available: number
}

export function RequestForm() {
  const [bookData, setBookData] = useState<BookData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BookData[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inputMode, setInputMode] = useState<'search' | 'manual'>('search')
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const form = useForm({
    defaultValues: {
      isbn: '',
      course_code: '',
      course_name: '',
      quantity: 1
    }
  })

  const searchBooks = async (query: string) => {
    if (query.length >= 2) {
      setLoading(true)
      try {
        const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
          setShowDropdown(true)
        } else {
          setSearchResults([])
          setShowDropdown(false)
        }
      } catch (error) {
        setSearchResults([])
        toast.error('Failed to search books')
      } finally {
        setLoading(false)
      }
    } else {
      setSearchResults([])
      setShowDropdown(false)
    }
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Reset selections
    setBookData(null)
    form.setValue('isbn', '')

    // Debounce the API call
    if (query.length >= 2) {
      debounceTimer.current = setTimeout(() => {
        searchBooks(query)
      }, 300) // Wait 300ms after user stops typing
    } else {
      setSearchResults([])
      setShowDropdown(false)
    }
  }

  const selectBook = (book: BookData) => {
    setBookData(book)
    setSearchQuery(book.title)
    form.setValue('isbn', book.isbn)
    setShowDropdown(false)
    setSearchResults([])
  }

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  const onSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/professor/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isbn: data.isbn,
          course_code: data.course_code,
          course_name: data.course_name,
          quantity_requested: data.quantity
        })
      })

      if (response.ok) {
        toast.success('Request submitted successfully!')
        form.reset()
        setBookData(null)
        setSearchQuery('')
        setSearchResults([])
        setShowDropdown(false)
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
            <Tabs defaultValue="search" onValueChange={(v) => {
              setInputMode(v as 'search' | 'manual')
              // Reset when switching modes
              setBookData(null)
              setSearchQuery('')
              form.setValue('isbn', '')
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">
                  <Search className="h-4 w-4 mr-2" />
                  Search Books
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Plus className="h-4 w-4 mr-2" />
                  Manual ISBN
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-4">
                {/* Search Input with Autocomplete */}
                <div className="space-y-2" ref={dropdownRef}>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Search for a Book
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search by title, author, or ISBN..."
                      className="pl-9"
                    />

                    {/* Dropdown Results */}
                    {showDropdown && searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-80 overflow-y-auto">
                        {searchResults.map((book) => (
                          <button
                            key={book.isbn}
                            type="button"
                            onClick={() => selectBook(book)}
                            className="w-full p-3 hover:bg-accent text-left border-b last:border-b-0 transition-colors"
                          >
                            <div className="flex gap-3">
                              {book.thumbnail_url && (
                                <img
                                  src={book.thumbnail_url}
                                  alt={book.title}
                                  className="w-12 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{book.title}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {book.authors.join(', ')}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  ISBN: {book.isbn}
                                </div>
                                <div className="mt-1">
                                  <Badge variant={getStockBadgeVariant(book.quantity_available)} className="text-xs">
                                    {book.quantity_available > 0
                                      ? `${book.quantity_available} available`
                                      : 'Out of stock'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* No Results Message */}
                    {showDropdown && searchResults.length === 0 && !loading && searchQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-4 text-center text-sm text-muted-foreground">
                        <Book className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No books found matching &quot;{searchQuery}&quot;</p>
                        <p className="text-xs mt-1">Try using the Manual ISBN tab to request this book</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type at least 2 characters to search
                  </p>
                </div>

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
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    ISBN Number
                  </label>
                  <Input
                    value={form.watch('isbn')}
                    onChange={(e) => form.setValue('isbn', e.target.value, { shouldValidate: true })}
                    placeholder="Enter 10 or 13 digit ISBN..."
                    maxLength={13}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the ISBN for a book not yet in our system
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* ISBN field - single registration with conditional validation */}
            <FormField
              control={form.control}
              name="isbn"
              rules={
                inputMode === 'search'
                  ? { required: 'Please select a book from the search results' }
                  : {
                      required: 'ISBN is required',
                      pattern: {
                        value: /^(?:\d{10}|\d{13})$/,
                        message: 'ISBN must be 10 or 13 digits'
                      }
                    }
              }
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl>
                    <Input {...field} type="hidden" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="course_code"
              rules={{
                required: 'Course code is required'
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="COSC 111"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="course_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Name (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Introduction to Computer Science"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <Button
              type="submit"
              className="w-full"
              disabled={inputMode === 'search' && !bookData}
            >
              Submit Request
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
