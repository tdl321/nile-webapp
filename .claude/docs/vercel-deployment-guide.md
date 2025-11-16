# Vercel Deployment Guide

## Deploying Nile Webapp to Vercel

This guide walks through deploying your Next.js webapp to Vercel with proper Supabase integration and environment configuration.

---

## Prerequisites

- ✅ GitHub account with access to `tdl321/nile-webapp` repository
- ✅ Vercel account (free tier works)
- ✅ Supabase project running
- ✅ Google Books API key (for book metadata)

---

## Step 1: Install Vercel CLI (Optional but Recommended)

```bash
npm install -g vercel
```

Or use without installing:
```bash
npx vercel
```

---

## Step 2: Connect GitHub Repository to Vercel

### Option A: Via Vercel Dashboard (Recommended for First Time)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository:
   - Search for `tdl321/nile-webapp`
   - Click **"Import"**
4. Configure Project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### Option B: Via Vercel CLI

```bash
# Navigate to your project
cd /Users/tdl321/nile-webapp

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? nile-webapp
# - Directory? ./
# - Override settings? No
```

---

## Step 3: Configure Environment Variables

### Required Environment Variables

Add these in Vercel Dashboard → Project → Settings → Environment Variables:

#### Supabase Variables

```bash
# Supabase URL (Public - can be exposed to client)
NEXT_PUBLIC_SUPABASE_URL=https://uwbkvpllovfnuylsddht.supabase.co

# Supabase Anon Key (Public - can be exposed to client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (Secret - server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find these**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (secret!) → `SUPABASE_SERVICE_ROLE_KEY`

#### Google Books API

```bash
# Google Books API Key (Secret - server-side only)
GOOGLE_BOOKS_API_KEY=your-google-books-api-key-here
```

**Where to find**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project or select existing
3. Enable **Books API**
4. Create credentials → API Key
5. Copy the key

#### Optional: AI/Chatbot Variables (For Future RAG Implementation)

```bash
# OpenAI API Key (for embeddings)
OPENAI_API_KEY=sk-your-openai-key

# DeepSeek API Key (for chat)
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

### How to Add Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: Variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: The actual value
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**

**IMPORTANT**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Keep secrets (like `SUPABASE_SERVICE_ROLE_KEY`) without this prefix!

---

## Step 4: Update Supabase Permissions & Policies

### A. Add Vercel Domain to Supabase Allowed Origins

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add your Vercel URLs to **Site URL** and **Redirect URLs**:

```
Site URL:
https://nile-webapp.vercel.app

Redirect URLs:
https://nile-webapp.vercel.app/**
https://nile-webapp-*.vercel.app/** (for preview deployments)
http://localhost:3000/** (for local development)
```

### B. Review Row Level Security (RLS) Policies

Your tables already have RLS enabled. Verify policies are correct:

#### scanned_books Table

```sql
-- Should allow service role full access
CREATE POLICY "Enable all access for service role"
  ON scanned_books
  FOR ALL
  USING (true);
```

#### books Table

```sql
-- Public can read
CREATE POLICY "Enable read access for all users"
  ON books
  FOR SELECT
  USING (true);

-- Service role can insert/update
CREATE POLICY "Enable insert for service role"
  ON books
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Enable update for service role"
  ON books
  FOR UPDATE
  USING (true);
```

#### professor_requests Table

```sql
-- Professors can read their own requests
CREATE POLICY "Professors can view own requests"
  ON professor_requests
  FOR SELECT
  USING (
    auth.uid() = professor_id
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Professors can insert their own requests
CREATE POLICY "Professors can create requests"
  ON professor_requests
  FOR INSERT
  WITH CHECK (auth.uid() = professor_id);

-- Only admins can update requests
CREATE POLICY "Admins can update requests"
  ON professor_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
```

### C. Update CORS Settings (If Needed)

Supabase typically handles CORS automatically, but if you have issues:

1. Go to Supabase Dashboard → **Settings** → **API**
2. Scroll to **CORS Settings**
3. Ensure your Vercel domains are allowed

---

## Step 5: Configure Next.js for Vercel

### A. Verify next.config.js (If It Exists)

Your project should work with default Next.js config. If you have a `next.config.js`, verify it looks like this:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server actions
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.vercel.app']
    }
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'books.google.com',
        pathname: '/books/**',
      },
    ],
  },
}

module.exports = nextConfig
```

### B. Create .vercelignore (Optional)

Create `.vercelignore` to exclude files from deployment:

```
# .vercelignore
.env*
.git
.claude
node_modules
.DS_Store
*.log
.next
out
```

---

## Step 6: Deploy!

### Via Vercel Dashboard

1. Go to your project in Vercel
2. Click **Deployments** tab
3. Click **"Redeploy"** or wait for automatic deployment on git push
4. Monitor build logs

### Via Vercel CLI

```bash
# Development preview
vercel

# Production deployment
vercel --prod
```

### Automatic Deployments

Once connected, Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches or pull requests

---

## Step 7: Test Your Deployment

### A. Check Health Endpoints

```bash
# Test scanner API
curl https://nile-webapp.vercel.app/api/scan

# Expected response:
{
  "message": "ISBN Scanner API",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

### B. Test Authentication

1. Visit `https://nile-webapp.vercel.app/login`
2. Sign in with Google
3. Verify redirect works
4. Check dashboard loads

### C. Test Scanner Integration

```bash
# Test scanning a book
curl -X POST https://nile-webapp.vercel.app/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "isbn": "9780262033848",
    "scanner_id": "test-scanner"
  }'

# Expected: Book data returned
```

---

## Step 8: Update Camera App Configuration

Once deployed, update your iPhone scanner app:

```swift
// Update API endpoint
struct APIConfig {
    static let baseURL = "https://nile-webapp.vercel.app"
    static let scanEndpoint = "\(baseURL)/api/scan"

    #if DEBUG
    // For local testing, keep localhost
    static let devEndpoint = "http://localhost:3000/api/scan"
    #endif
}
```

---

## Common Issues & Solutions

### Issue 1: Build Fails with TypeScript Errors

**Solution**: Fix TypeScript errors locally first
```bash
npm run build
# Fix any errors, then commit and push
```

### Issue 2: Environment Variables Not Working

**Symptoms**:
- "SUPABASE_URL is undefined"
- API calls fail
- Authentication doesn't work

**Solution**:
1. Verify variables are set in Vercel Dashboard
2. Check variable names match exactly (case-sensitive)
3. Redeploy after adding variables
4. Remember: Only `NEXT_PUBLIC_*` variables are available in browser

### Issue 3: Supabase Auth Redirect Fails

**Symptoms**: After Google login, redirects to wrong URL

**Solution**:
1. Add Vercel URL to Supabase **Redirect URLs**
2. Update `NEXT_PUBLIC_SITE_URL` environment variable
3. Check your auth callback route

### Issue 4: API Routes Return 404

**Symptoms**: `/api/scan` returns 404

**Solution**:
1. Verify file is at `app/api/scan/route.ts` (App Router)
2. Check deployment logs for build errors
3. Ensure `next.config.js` doesn't exclude API routes

### Issue 5: CORS Errors

**Symptoms**: Browser shows CORS errors when scanner app calls API

**Solution**:
1. Add CORS headers to API routes:

```typescript
// app/api/scan/route.ts
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request: Request) {
  // ... your existing code

  // Add CORS headers to response
  const response = NextResponse.json(data)
  response.headers.set('Access-Control-Allow-Origin', '*')
  return response
}
```

---

## Performance Optimization

### A. Enable Edge Runtime (Optional)

For faster API responses, use Edge runtime:

```typescript
// app/api/scan/route.ts
export const runtime = 'edge' // Add this line

export async function POST(request: Request) {
  // ... your code
}
```

**Note**: Edge runtime has some limitations (no Node.js APIs)

### B. Configure Caching

Add caching headers for book data:

```typescript
export async function GET(request: Request) {
  // ... fetch book data

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
```

### C. Image Optimization

Ensure book cover images use Next.js Image component:

```tsx
import Image from 'next/image'

<Image
  src={book.thumbnail_url}
  alt={book.title}
  width={128}
  height={192}
  loader={({ src }) => src} // For external images
/>
```

---

## Monitoring & Analytics

### A. Vercel Analytics (Built-in)

1. Go to Vercel Dashboard → **Analytics**
2. Enable **Web Analytics** (free)
3. Enable **Speed Insights** (free)

### B. Set Up Error Monitoring

Consider adding error tracking:

```bash
npm install @vercel/analytics
```

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

---

## Security Checklist

Before going live:

- [ ] All sensitive keys are in environment variables (not in code)
- [ ] `.env` files are in `.gitignore`
- [ ] Service role key is NOT prefixed with `NEXT_PUBLIC_`
- [ ] Supabase RLS policies are enabled and tested
- [ ] CORS is configured properly
- [ ] Rate limiting is enabled (recommended)
- [ ] Google OAuth redirect URLs are correct
- [ ] No console.log() statements with sensitive data

---

## Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] Supabase redirect URLs updated
- [ ] Build succeeds locally (`npm run build`)
- [ ] All tests pass
- [ ] TypeScript has no errors
- [ ] API endpoints tested
- [ ] Authentication flow tested
- [ ] Scanner app endpoint updated
- [ ] DNS configured (if custom domain)
- [ ] SSL certificate active (automatic with Vercel)

---

## Post-Deployment Tasks

### 1. Update Scanner App

Update the scanner app to use production URL:
```swift
static let baseURL = "https://nile-webapp.vercel.app"
```

### 2. Run Backfill Script

If you have missing books, run the backfill:
```bash
# Connect to production
vercel env pull
npm run backfill-books
```

### 3. Monitor First 24 Hours

- Check deployment logs
- Monitor error rates
- Test all major flows
- Watch for rate limit issues

### 4. Set Up Alerts

Configure Vercel to email you on:
- Build failures
- Deployment errors
- Performance degradation

---

## Custom Domain (Optional)

### A. Add Domain to Vercel

1. Go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `nile.yourdomain.com`)
4. Follow DNS configuration instructions

### B. Update DNS

Add these records to your DNS provider:

```
Type: CNAME
Name: nile (or @)
Value: cname.vercel-dns.com
```

### C. Update Environment & Supabase

1. Update `NEXT_PUBLIC_SITE_URL` to your custom domain
2. Add custom domain to Supabase redirect URLs
3. Update scanner app endpoint

---

## Cost Estimation

### Vercel (Free Tier)
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ DDoS protection
- ✅ Web Analytics

**Hobby plan is FREE and should be sufficient!**

If you need more:
- **Pro**: $20/month (1TB bandwidth, team features)
- **Enterprise**: Custom pricing

### What Counts Toward Limits
- Bandwidth: Serving pages, API responses, images
- Build minutes: Usually not an issue
- Serverless function executions: Your API routes

**Estimate for your app**: Well within free tier limits

---

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Supabase + Vercel Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Vercel Support](https://vercel.com/support)

---

## Quick Reference Commands

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy production
vercel --prod

# View logs
vercel logs [deployment-url]

# Pull environment variables locally
vercel env pull

# List deployments
vercel list

# Remove deployment
vercel remove [deployment-url]
```

---

## Next Steps After Deployment

1. ✅ Test scanner app with production URL
2. ✅ Monitor first scans and book additions
3. ✅ Set up continuous deployment (automatic on git push)
4. ⏳ Implement RAG chatbot (future)
5. ⏳ Add analytics and monitoring
6. ⏳ Optimize performance based on usage

---

**You're ready to deploy! 🚀**

Start with: `npx vercel` or use the Vercel Dashboard to import your GitHub repo.
