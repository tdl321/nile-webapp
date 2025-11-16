# Playwright MCP Tools Guide for Nile Web App

This document outlines the most applicable Playwright tools for testing and automating the Nile book request management system.

## Project Context

**Nile Web App** is a Next.js 16 application that manages book requests for professors and administrators. Key features include:

- Google OAuth authentication via Supabase
- Professor interface for submitting and tracking book requests
- Admin dashboard for managing inventory and approving/denying requests
- Real-time data synchronization with Supabase
- Shadcn UI components with Radix UI primitives

---

## Essential Playwright Tools for This Project

### 1. Navigation & Page Management

#### `playwright_navigate`
**Use Case**: Navigate to different pages in your app
- Login page: `http://localhost:3000/login`
- Professor request page: `http://localhost:3000/professor/request`
- Admin dashboard: `http://localhost:3000/admin/dashboard`

**Example Usage**:
```
"Navigate to http://localhost:3000/login"
```

**When to Use**:
- Starting test flows
- Testing different user role pages
- Verifying routing behavior

---

### 2. Authentication & Forms

#### `playwright_click`
**Use Case**: Interact with buttons and clickable elements
- Click "Continue with Google" button on login page
- Click "Sign Out" button
- Click "Submit Request" on professor form
- Click approve/deny actions in admin dashboard

**Example Usage**:
```
"Click the button with text 'Continue with Google'"
"Click the 'Sign Out' button"
```

**When to Use**:
- Testing OAuth flow initiation
- Form submissions
- Admin action buttons
- Tab navigation

#### `playwright_fill`
**Use Case**: Fill form inputs
- Book request form fields (title, ISBN, authors, course info)
- Search input in admin dashboard
- Any text input fields

**Example Usage**:
```
"Fill the input with placeholder 'Search by title, ISBN, or author...' with 'Machine Learning'"
```

**When to Use**:
- Testing professor book request form
- Testing admin search functionality
- Form validation scenarios

---

### 3. Element Inspection & Verification

#### `playwright_evaluate`
**Use Case**: Execute JavaScript to extract data or verify state
- Check if user is authenticated
- Extract table data from request history
- Verify inventory counts
- Check pending request badges

**Example Usage**:
```
"Evaluate and return the text content of all table rows in the inventory"
"Check if the pending requests count badge is visible"
```

**When to Use**:
- Verifying data rendering
- Checking dashboard statistics
- Validating form state
- Reading table contents

#### `playwright_screenshot`
**Use Case**: Capture visual state of pages
- Document UI states
- Capture error messages
- Record test results
- Visual regression testing

**Example Usage**:
```
"Take a screenshot of the current page"
"Screenshot the admin dashboard"
```

**When to Use**:
- Documenting bugs
- Visual testing
- Creating documentation
- Debugging layout issues

---

### 4. Component Interaction

#### `playwright_select_option`
**Use Case**: Interact with select dropdowns (using Radix UI Select)
- May be used for filtering in future features
- Status filters
- Role selection

**Example Usage**:
```
"Select 'Pending' from the status dropdown"
```

**When to Use**:
- Testing filters
- Form select inputs
- Status changes

---

### 5. Testing & Validation

#### `playwright_wait_for_selector`
**Use Case**: Wait for dynamic content to load
- Wait for Supabase data to load
- Wait for tables to populate
- Wait for skeleton loaders to disappear
- Wait for toasts/notifications

**Example Usage**:
```
"Wait for the table with book inventory to appear"
"Wait for the skeleton loader to disappear"
```

**When to Use**:
- Testing async data fetching
- Ensuring components are ready
- Waiting for API responses
- Form submission feedback

---

## Common Testing Workflows

### Workflow 1: Testing Professor Book Request Flow
```
1. Navigate to login page
2. Click "Continue with Google"
3. (Manual OAuth login)
4. Wait for redirect to professor request page
5. Fill book request form fields
6. Click submit button
7. Wait for success toast
8. Verify request appears in history table
9. Take screenshot of completed request
```

### Workflow 2: Testing Admin Dashboard
```
1. Navigate to admin dashboard
2. Wait for inventory table to load
3. Evaluate and count total books
4. Fill search input with book title
5. Wait for filtered results
6. Click on a book with pending requests
7. Verify pending requests modal appears
8. Take screenshot of modal
```

### Workflow 3: Testing Authentication Flow
```
1. Navigate to login page
2. Click Google sign-in button
3. Wait for OAuth redirect
4. Verify user email displays in header
5. Click sign out button
6. Verify redirect to login page
```

---

## Tools NOT Recommended for This Project

### Limited Applicability Tools:

- **`playwright_drag_and_drop`**: No drag-drop functionality in current UI
- **`playwright_check`/`playwright_uncheck`**: No checkboxes in current forms
- **`playwright_hover`**: Limited hover interactions needed
- **`playwright_press`**: Minimal keyboard navigation requirements
- **`playwright_go_back`/`playwright_go_forward`**: SPA navigation handles this

---

## Best Practices

### 1. **Use Explicit Waits**
Always wait for elements before interacting:
```
"Wait for the request form to appear before filling it"
```

### 2. **Take Screenshots for Documentation**
Capture key states for bug reports and documentation:
```
"Take a screenshot after submitting the book request"
```

### 3. **Use Descriptive Selectors**
Reference elements by visible text, labels, or placeholders:
```
"Click the button with text 'Submit Request'" (better)
vs
"Click button.submit-btn" (worse - fragile)
```

### 4. **Test Data Loading States**
Verify skeleton loaders and loading states:
```
"Wait for the skeleton loader to disappear"
"Verify the table has loaded data"
```

### 5. **Verify User Feedback**
Check for toasts, alerts, and notifications (using Sonner):
```
"Wait for success toast to appear"
"Verify error message is displayed"
```

---

## Tool Priority Matrix

| Priority | Tool | Frequency of Use |
|----------|------|------------------|
| **High** | `playwright_navigate` | Every test |
| **High** | `playwright_click` | Every test |
| **High** | `playwright_fill` | Forms, Search |
| **High** | `playwright_wait_for_selector` | Async operations |
| **Medium** | `playwright_evaluate` | Data verification |
| **Medium** | `playwright_screenshot` | Documentation, Debugging |
| **Low** | `playwright_select_option` | Future features |
| **Low** | Other tools | Edge cases |

---

## Environment Setup

Before using Playwright tools, ensure:

1. **Development server is running**:
   ```bash
   npm run dev
   ```
   App runs on `http://localhost:3000`

2. **Supabase connection is configured**:
   - Environment variables are set
   - Database is accessible
   - OAuth is configured

3. **Playwright MCP is installed**:
   ```bash
   claude mcp add playwright npx -- @playwright/mcp@latest
   ```

---

## Quick Reference Commands

### Start Testing Session
```
"Navigate to http://localhost:3000"
"Take a screenshot of the homepage"
```

### Test Login
```
"Navigate to http://localhost:3000/login"
"Click the Continue with Google button"
```

### Test Professor Interface
```
"Navigate to http://localhost:3000/professor/request"
"Fill the ISBN input with '978-0134685991'"
"Fill the title input with 'Effective Java'"
"Click Submit Request"
```

### Test Admin Dashboard
```
"Navigate to http://localhost:3000/admin/dashboard"
"Wait for the inventory table to load"
"Fill the search input with 'Java'"
"Take a screenshot of the filtered results"
```

---

## Troubleshooting

### Issue: Elements not found
**Solution**: Use `playwright_wait_for_selector` before interacting

### Issue: OAuth redirect fails
**Solution**: Manually complete OAuth, then continue automation

### Issue: Data not loading
**Solution**: Check Supabase connection and wait for skeleton loaders to disappear

### Issue: Buttons not clickable
**Solution**: Ensure page is fully loaded and elements are not disabled

---

## Additional Resources

- [Playwright MCP Documentation](https://executeautomation.github.io/mcp-playwright/)
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
- [Supabase Auth Testing](https://supabase.com/docs/guides/auth)

---

**Last Updated**: 2025-11-16
**Project**: Nile Web App
**Framework**: Next.js 16 + Supabase + Shadcn UI
