# RAG Chatbot Implementation Guide

## Building a Book Inventory Assistant with Vercel AI SDK, Supabase pgvector, and DeepSeek

This guide provides detailed steps to implement a Retrieval Augmented Generation (RAG) chatbot for the Nile book inventory system using Vercel AI SDK, Supabase's pgvector extension, and DeepSeek's cost-effective AI models.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Phase 1: Database Setup](#phase-1-database-setup)
5. [Phase 2: Embedding Generation](#phase-2-embedding-generation)
6. [Phase 3: Vector Search Function](#phase-3-vector-search-function)
7. [Phase 4: API Route Implementation](#phase-4-api-route-implementation)
8. [Phase 5: Chat UI Component](#phase-5-chat-ui-component)
9. [Phase 6: Deployment & Optimization](#phase-6-deployment--optimization)
10. [Cost Analysis](#cost-analysis)
11. [Example Queries](#example-queries)

---

## Overview

### What We're Building

A chatbot that can answer questions about your book inventory by:
- Understanding natural language queries
- Retrieving relevant book information from the database
- Generating accurate, context-aware responses
- Providing real-time inventory information

### Key Technologies

- **Vercel AI SDK**: Unified interface for AI models and embeddings
- **Supabase pgvector**: PostgreSQL extension for vector similarity search
- **DeepSeek API**: Cost-effective language models
- **OpenAI Embeddings**: High-quality text embeddings (or alternatives)
- **Next.js**: Full-stack React framework

---

## Architecture

```
User Query
    ↓
[Chat UI Component]
    ↓
[POST /api/chat]
    ↓
[Generate Query Embedding]
    ↓
[Vector Similarity Search] → Supabase pgvector
    ↓
[Retrieve Book Context]
    ↓
[LLM with Context] → DeepSeek API
    ↓
[Stream Response] → Chat UI
```

---

## Prerequisites

### 1. Install Dependencies

```bash
npm install ai @ai-sdk/openai openai
```

### 2. Environment Variables

Add to your `.env.local`:

```bash
# OpenAI API Key (for embeddings)
OPENAI_API_KEY=sk-your-openai-key-here

# DeepSeek API Key (for chat completion)
DEEPSEEK_API_KEY=sk-your-deepseek-key-here

# DeepSeek API Base URL
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Get API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **DeepSeek**: https://platform.deepseek.com/api_keys

---

## Phase 1: Database Setup

### Step 1.1: Enable pgvector Extension

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

### Step 1.2: Create Embeddings Table

```sql
-- Create table to store book content embeddings
CREATE TABLE book_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_isbn TEXT NOT NULL REFERENCES books(isbn) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE book_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role access
CREATE POLICY "Enable all access for service role"
  ON book_embeddings
  FOR ALL
  USING (true);

-- Create index for fast similarity search
-- Using HNSW index (Hierarchical Navigable Small World) for better performance
CREATE INDEX ON book_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build, slightly slower query)
-- CREATE INDEX ON book_embeddings
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);
```

### Step 1.3: Create Trigger for Updated Timestamp

```sql
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_book_embeddings_updated_at
    BEFORE UPDATE ON book_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## Phase 2: Embedding Generation

### Step 2.1: Create Embedding Utility

Create `lib/ai/embeddings.ts`:

```typescript
import { openai } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'

const embeddingModel = openai.embedding('text-embedding-3-small')

/**
 * Generate embedding for a single text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.replaceAll('\n', ' ').trim()

  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  })

  return embedding
}

/**
 * Generate embeddings for multiple text strings
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const inputs = texts.map(text => text.replaceAll('\n', ' ').trim())

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: inputs,
  })

  return embeddings
}

/**
 * Create searchable content from book data
 */
export function createBookContent(book: any): string {
  const parts = [
    `Title: ${book.title}`,
    book.subtitle ? `Subtitle: ${book.subtitle}` : '',
    book.authors?.length > 0 ? `Authors: ${book.authors.join(', ')}` : '',
    book.publisher ? `Publisher: ${book.publisher}` : '',
    book.published_date ? `Published: ${book.published_date}` : '',
    book.categories?.length > 0 ? `Categories: ${book.categories.join(', ')}` : '',
    book.description ? `Description: ${book.description}` : '',
    `ISBN: ${book.isbn}`,
    `Available Copies: ${book.quantity_available || 0}`,
  ]

  return parts.filter(Boolean).join('\n')
}
```

### Step 2.2: Create Initial Embedding Script

Create `scripts/generate-embeddings.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateEmbedding, createBookContent } from '@/lib/ai/embeddings'

async function generateAllEmbeddings() {
  console.log('🚀 Starting embedding generation...')

  const supabase = await createServiceRoleClient()

  // Fetch all books
  const { data: books, error: fetchError } = await supabase
    .from('books')
    .select('*')

  if (fetchError) {
    console.error('❌ Error fetching books:', fetchError)
    return
  }

  console.log(`📚 Found ${books.length} books`)

  for (const book of books) {
    try {
      // Create searchable content
      const content = createBookContent(book)

      // Generate embedding
      console.log(`⏳ Generating embedding for: ${book.title}`)
      const embedding = await generateEmbedding(content)

      // Store in database
      const { error: insertError } = await supabase
        .from('book_embeddings')
        .upsert({
          book_isbn: book.isbn,
          content,
          embedding,
          metadata: {
            title: book.title,
            authors: book.authors,
          }
        }, {
          onConflict: 'book_isbn'
        })

      if (insertError) {
        console.error(`❌ Error storing embedding for ${book.isbn}:`, insertError)
      } else {
        console.log(`✅ Embedded: ${book.title}`)
      }

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`❌ Error processing ${book.isbn}:`, error)
    }
  }

  console.log('✨ Embedding generation complete!')
}

generateAllEmbeddings()
```

### Step 2.3: Add Script to package.json

```json
{
  "scripts": {
    "generate-embeddings": "tsx scripts/generate-embeddings.ts"
  }
}
```

### Step 2.4: Run Initial Embedding Generation

```bash
npm install -D tsx
npm run generate-embeddings
```

---

## Phase 3: Vector Search Function

### Step 3.1: Create PostgreSQL Vector Search Function

Run this SQL in Supabase SQL Editor:

```sql
-- Function to find similar book content using vector similarity
CREATE OR REPLACE FUNCTION match_book_content(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  book_isbn TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    book_embeddings.id,
    book_embeddings.book_isbn,
    book_embeddings.content,
    1 - (book_embeddings.embedding <=> query_embedding) AS similarity,
    book_embeddings.metadata
  FROM book_embeddings
  WHERE 1 - (book_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY book_embeddings.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
```

### Step 3.2: Create TypeScript Helper for Vector Search

Create `lib/ai/vector-search.ts`:

```typescript
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateEmbedding } from './embeddings'

export interface SearchResult {
  id: string
  book_isbn: string
  content: string
  similarity: number
  metadata: any
}

/**
 * Search for relevant book content using vector similarity
 */
export async function searchBookContent(
  query: string,
  options: {
    matchThreshold?: number
    matchCount?: number
  } = {}
): Promise<SearchResult[]> {
  const {
    matchThreshold = 0.7,
    matchCount = 5
  } = options

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query)

  // Search for similar content
  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase.rpc('match_book_content', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount
  })

  if (error) {
    console.error('Vector search error:', error)
    throw error
  }

  return data || []
}
```

---

## Phase 4: API Route Implementation

### Step 4.1: Configure DeepSeek Provider

Create `lib/ai/deepseek.ts`:

```typescript
import { createOpenAI } from '@ai-sdk/openai'

/**
 * DeepSeek provider configuration
 * Uses OpenAI-compatible API
 */
export const deepseek = createOpenAI({
  name: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
})

/**
 * Available DeepSeek models
 * - deepseek-chat: Latest chat model (recommended)
 * - deepseek-coder: Specialized for code (if needed)
 */
export const deepseekChat = deepseek('deepseek-chat')
```

### Step 4.2: Create Chat API Route

Create `app/api/chat/route.ts`:

```typescript
import { streamText } from 'ai'
import { deepseekChat } from '@/lib/ai/deepseek'
import { searchBookContent } from '@/lib/ai/vector-search'

export const runtime = 'edge' // Optional: use edge runtime for faster responses

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Get the last user message
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response('Invalid message format', { status: 400 })
    }

    // Search for relevant book content
    console.log('🔍 Searching for relevant content...')
    const searchResults = await searchBookContent(lastMessage.content, {
      matchThreshold: 0.6,
      matchCount: 5
    })

    console.log(`📊 Found ${searchResults.length} relevant results`)

    // Build context from search results
    const context = searchResults
      .map((result, index) =>
        `[Book ${index + 1}] (Similarity: ${(result.similarity * 100).toFixed(1)}%)\n${result.content}`
      )
      .join('\n\n---\n\n')

    // System prompt for the assistant
    const systemPrompt = `You are a helpful library assistant for the Nile Book Inventory System.

Your role is to help users find books, check availability, and answer questions about the inventory.

IMPORTANT INSTRUCTIONS:
- Only use information from the provided context to answer questions
- If you don't have enough information in the context, say so clearly
- When mentioning books, include the title, authors, and availability
- Be concise and helpful
- If a book is out of stock (0 available copies), mention it clearly
- Format your responses in a clear, readable way

CURRENT BOOK INVENTORY CONTEXT:
${context || 'No relevant books found in the inventory.'}

---

If no relevant context is provided, politely inform the user that you don't have information about that topic in the current inventory.`

    // Generate streaming response
    const result = streamText({
      model: deepseekChat,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...messages
      ],
      temperature: 0.3, // Lower temperature for more factual responses
      maxTokens: 1000,
    })

    return result.toDataStreamResponse()

  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
```

---

## Phase 5: Chat UI Component

### Step 5.1: Create Chat Component

Create `components/chat/book-chat.tsx`:

```typescript
'use client'

import { useChat } from 'ai/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Send, Bot, User } from 'lucide-react'

export function BookChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Book Inventory Assistant
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Ask me anything about our book inventory!</p>
              <div className="mt-4 text-sm space-y-1">
                <p>Try asking:</p>
                <ul className="list-disc list-inside">
                  <li>"What books do we have about programming?"</li>
                  <li>"Show me books by a specific author"</li>
                  <li>"Are there any low stock Computer Science books?"</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <Bot className="h-8 w-8 p-1.5 bg-primary text-primary-foreground rounded-full" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <User className="h-8 w-8 p-1.5 bg-muted rounded-full" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <Bot className="h-8 w-8 p-1.5 bg-primary text-primary-foreground rounded-full" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about books..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

### Step 5.2: Add Chat to Admin Dashboard

Update `app/admin/dashboard/page.tsx`:

```typescript
import { BookChat } from '@/components/chat/book-chat'

// ... existing code ...

// Add inside your dashboard, perhaps in a new tab
<TabsContent value="assistant" className="space-y-4">
  <BookChat />
</TabsContent>
```

Or create a dedicated page at `app/admin/assistant/page.tsx`:

```typescript
'use client'

import { BookChat } from '@/components/chat/book-chat'

export default function AssistantPage() {
  return (
    <div className="container mx-auto py-8">
      <BookChat />
    </div>
  )
}
```

---

## Phase 6: Deployment & Optimization

### Step 6.1: Auto-Update Embeddings

Create `app/api/books/update-embedding/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateEmbedding, createBookContent } from '@/lib/ai/embeddings'

export async function POST(request: NextRequest) {
  try {
    const { isbn } = await request.json()

    if (!isbn) {
      return NextResponse.json(
        { error: 'ISBN is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceRoleClient()

    // Fetch book data
    const { data: book, error: fetchError } = await supabase
      .from('books')
      .select('*')
      .eq('isbn', isbn)
      .single()

    if (fetchError || !book) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      )
    }

    // Generate embedding
    const content = createBookContent(book)
    const embedding = await generateEmbedding(content)

    // Update or insert embedding
    const { error: upsertError } = await supabase
      .from('book_embeddings')
      .upsert({
        book_isbn: isbn,
        content,
        embedding,
        metadata: {
          title: book.title,
          authors: book.authors,
        }
      })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating embedding:', error)
    return NextResponse.json(
      { error: 'Failed to update embedding' },
      { status: 500 }
    )
  }
}
```

### Step 6.2: Call from Scan Route

Update `app/api/scan/route.ts` to auto-generate embeddings:

```typescript
// After successfully inserting/updating a book
if (bookData) {
  // Trigger embedding generation (non-blocking)
  fetch('/api/books/update-embedding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isbn: normalizedISBN })
  }).catch(err => console.error('Embedding update failed:', err))
}
```

### Step 6.3: Optimize Vector Index

Monitor query performance and adjust index parameters:

```sql
-- Check index statistics
SELECT * FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%book_embeddings%';

-- Re-index if needed (for IVFFlat)
REINDEX INDEX book_embeddings_embedding_idx;

-- Or rebuild with better parameters
DROP INDEX book_embeddings_embedding_idx;
CREATE INDEX ON book_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 128); -- Higher values = better accuracy, slower build
```

---

## Cost Analysis

### OpenAI Embeddings (text-embedding-3-small)
- **Cost**: $0.00002 / 1K tokens (~$0.02 / 1M tokens)
- **Example**: 1,000 books × 500 tokens each = 500K tokens = **$0.01**
- **Monthly queries**: 10,000 queries × 100 tokens each = 1M tokens = **$0.02/month**

### DeepSeek Chat (deepseek-chat)
- **Input**: $0.14 / 1M tokens
- **Output**: $0.28 / 1M tokens
- **Example**: 10,000 queries with 500 input + 200 output tokens each
  - Input: 5M tokens × $0.14 = **$0.70**
  - Output: 2M tokens × $0.28 = **$0.56**
  - **Total**: **$1.26/month**

### Total Estimated Monthly Cost
For 10,000 queries/month: **~$1.50/month**

**Much cheaper than GPT-4:**
- GPT-4 Turbo would cost ~$150/month for the same usage
- **DeepSeek saves 99% on LLM costs!**

---

## Example Queries

Here are some queries your chatbot can handle:

### Inventory Questions
```
"What programming books do we have?"
"Show me books about calculus"
"Do we have any books by Robert Martin?"
"What's available in the Computer Science category?"
```

### Availability Checks
```
"Which books are low on stock?"
"Is Introduction to Algorithms available?"
"How many copies of Clean Code do we have?"
```

### Request Information
```
"What books have professors recently requested?"
"Are there any pending requests for math books?"
```

### General Questions
```
"What's the newest book in our inventory?"
"Tell me about books published by O'Reilly"
"What are our most popular categories?"
```

---

## Troubleshooting

### Common Issues

**1. Embeddings not generating**
- Check API keys in `.env.local`
- Verify network connectivity
- Check rate limits on OpenAI

**2. Vector search returns no results**
- Lower `match_threshold` (try 0.5 or 0.6)
- Check if embeddings exist in database
- Verify embedding dimensions match (1536)

**3. Slow queries**
- Add/rebuild vector index
- Reduce `match_count`
- Use Edge runtime for API routes

**4. DeepSeek API errors**
- Verify API key is correct
- Check base URL configuration
- Ensure proper OpenAI compatibility mode

---

## Next Steps

### Enhancements

1. **Add conversation memory** - Store chat history per user
2. **Implement streaming UI** - Better UX with progressive responses
3. **Add citations** - Show which books the answer came from
4. **Multi-turn conversations** - Context-aware follow-up questions
5. **Voice interface** - Speech-to-text integration
6. **Analytics** - Track popular queries and improve embeddings

### Advanced Features

1. **Hybrid search** - Combine vector search with keyword search
2. **Reranking** - Use a reranking model for better results
3. **Custom embeddings** - Fine-tune embeddings on your domain
4. **Multi-modal** - Add book cover image search
5. **Real-time updates** - Use Supabase Realtime for live inventory

---

## References

### Documentation
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Supabase pgvector Guide](https://supabase.com/docs/guides/database/extensions/pgvector)
- [DeepSeek API Docs](https://platform.deepseek.com/docs)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

### Code Examples
- [AI SDK RAG Cookbook](https://github.com/vercel/ai/blob/main/content/cookbook/05-node/100-retrieval-augmented-generation.mdx)
- [Supabase Vector Search Examples](https://github.com/supabase/supabase/tree/master/examples/ai)

---

## Support

For questions or issues:
- Check the [Vercel AI SDK Discord](https://discord.gg/vercel)
- Browse [Supabase Community](https://github.com/supabase/supabase/discussions)
- Review [DeepSeek Documentation](https://platform.deepseek.com/docs)

---

**Ready to build your RAG chatbot? Start with Phase 1!** 🚀
