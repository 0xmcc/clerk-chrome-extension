# Google OAuth Setup Guide for Chrome Extension

This guide walks you through setting up Google OAuth with Clerk session synchronization for your Chrome extension.

## What's Been Configured

The following files have been updated to enable session synchronization between your web app and Chrome extension:

1. **[.env.development](.env.development)** - Added `PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost`
2. **[.env.production](.env.production)** - Created with production environment variables (needs your values)
3. **[package.json](package.json)** - Updated `host_permissions` to use `$PLASMO_PUBLIC_CLERK_SYNC_HOST`
4. **[src/popup.tsx](src/popup.tsx)** - Added `syncHost` prop to ClerkProvider and simplified AuthDebugger
5. **[src/background.ts](src/background.ts)** - Created background service worker for persistent session management

## How Session Sync Works

The background service worker ([src/background.ts](src/background.ts)) maintains your authentication session persistently, even when the popup is closed. It automatically refreshes session tokens every 60 seconds.

**Important Limitation:** When a user authenticates in your web app, you need to **close and reopen the extension popup** to see the updated auth status. The sync happens when the popup opens, not continuously while it's open.

## Required Manual Steps

### 1. Configure Production Environment Variables

Edit [.env.production](.env.production) and replace the placeholder values:

```env
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
CLERK_FRONTEND_API=https://your-production-app.clerk.accounts.dev
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://yourdomain.com
```

You can find these values in your [Clerk Dashboard](https://dashboard.clerk.com).

### 2. Enable Google OAuth in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **User & Authentication** → **Social Connections**
4. Click on **Google** and enable it
5. Follow the prompts to configure your Google OAuth credentials
6. Set up redirect URIs as needed

### 3. Get Your Chrome Extension ID

Build your extension to get the extension ID:

```bash
npm run build
```

After building, you can find your extension ID by:
- Looking at the build output
- Or loading the extension in Chrome and checking `chrome://extensions/`

The extension ID is consistent because you have a `CRX_PUBLIC_KEY` configured in [.env.chrome](.env.chrome).

### 4. Register Extension in Clerk (Development)

You need to allowlist your Chrome extension ID in Clerk for both development and production environments.

#### Get Your Clerk Secret Key

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Developers** → **API Keys**
3. Copy your **Secret Key** (starts with `sk_test_` for development)

#### Register the Extension

Replace `<YOUR_SECRET_KEY>` and `<EXTENSION_ID>` with your actual values:

```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer <YOUR_SECRET_KEY>" \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://<EXTENSION_ID>"]}'
```

**Example:**
```bash
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer sk_test_abc123..." \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://abcdefghijklmnopqrstuvwxyz123456"]}'
```

### 5. Register Extension in Clerk (Production)

Repeat step 4 using your **production** secret key (starts with `sk_live_`).

**Important:** You must register the extension ID for BOTH development and production Clerk instances.

### 6. Create a Web Application

For session synchronization to work, you need a web application with Clerk configured:

1. Create a web app (React, Next.js, etc.)
2. Install and configure Clerk with the same publishable key
3. Enable Google OAuth (same as step 2)
4. Deploy the web app to the domain specified in `PLASMO_PUBLIC_CLERK_SYNC_HOST`

When users authenticate on the web app, they'll automatically be authenticated in the Chrome extension (after closing and reopening the popup).

## Development Workflow

### Local Development

1. Update `PLASMO_PUBLIC_CLERK_SYNC_HOST` in [.env.development](.env.development) to match your web app URL (e.g., `http://localhost:3000`)
2. Start your local web app
3. Run the extension in development mode:
   ```bash
   npm run dev
   ```
4. Load the extension in Chrome from `build/chrome-mv3-dev/`
5. Sign in to your web app with Google OAuth
6. **Close and reopen the extension popup** to see the synced auth state

### Production Build

1. Ensure [.env.production](.env.production) is configured
2. Build the extension:
   ```bash
   npm run build
   ```
3. Package for distribution:
   ```bash
   npm run package
   ```

## Testing Session Sync

1. Make sure you're signed out of both the web app and extension
2. Open your web application in a browser tab
3. Sign in with Google OAuth
4. **Close the extension popup if it's open**
5. Open the Chrome extension popup
6. The extension should show you as signed in without requiring separate login

**Important:** The session sync happens when you open the popup, not while it's already open. Always close and reopen the popup after authenticating in the web app to see the updated auth state.

## Troubleshooting

### Extension Not Syncing

1. Check that `PLASMO_PUBLIC_CLERK_SYNC_HOST` matches your web app domain
2. Verify the extension ID is registered in Clerk (check both dev and prod)
3. Check browser console for CORS or permission errors
4. Ensure `host_permissions` are granted in the extension

### OAuth Not Working

1. Verify Google OAuth is enabled in Clerk Dashboard
2. Check redirect URIs are configured correctly
3. Ensure extension ID is allowlisted in Clerk

### Environment Variables Not Loading

1. Restart the development server after changing `.env` files
2. Rebuild the extension for production changes
3. Check for typos in variable names (must start with `PLASMO_PUBLIC_`)

## Additional Resources

- [Clerk Session Sync Documentation](https://clerk.com/docs/guides/sessions/sync-host)
- [Clerk Chrome Extension Guide](https://clerk.com/docs/reference/chrome-extension/overview)
- [Plasmo Framework Documentation](https://docs.plasmo.com/)

## Architecture Notes

Your extension uses:
- **Framework:** Plasmo
- **Manifest Version:** 3
- **Auth Provider:** Clerk with `@clerk/chrome-extension`
- **Routing:** React Router (MemoryRouter)
- **Styling:** TailwindCSS

The extension already has debugging features built-in (see [AuthDebugger in popup.tsx](src/popup.tsx#L27-L86)) that log authentication state changes to help you verify session sync is working.
