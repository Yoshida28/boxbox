# Google OAuth Setup Guide

## 🔐 Setting up Google Authentication

To enable Gmail/Google authentication in your BoxBox F1 app, you need to configure Google OAuth in your Supabase project.

### 📋 Prerequisites
- Supabase project set up
- Google Cloud Console access
- Domain name for your app

### 🚀 Step-by-Step Setup

#### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google+ API** (or **Google Identity API**)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/v1/callback` (for development)

#### 2. Supabase Configuration
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Add your Google OAuth credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
5. Set **Redirect URL**: `https://your-project-ref.supabase.co/auth/v1/callback`

#### 3. Environment Variables
Add to your `.env.local`:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 🎯 Features Enabled
- ✅ **One-click Google sign-in**
- ✅ **Automatic profile creation**
- ✅ **Google profile picture**
- ✅ **Full name from Google**
- ✅ **Secure OAuth flow**
- ✅ **Mobile-optimized UI**

### 📱 Mobile Experience
- Clean Google sign-in button
- Automatic redirect after authentication
- Profile picture display
- Seamless user experience

### 🔧 Testing
1. Start your development server
2. Navigate to `/auth`
3. Click "Continue with Google"
4. Complete Google OAuth flow
5. You should be redirected to `/dashboard`

### 🚨 Important Notes
- Make sure your domain is added to Google OAuth settings
- Test both development and production URLs
- Google OAuth requires HTTPS in production
- Users will be automatically created in your Supabase `auth.users` table

### 🎉 Result
Your BoxBox F1 app now has:
- **No password management** - Users sign in with Google
- **Better security** - OAuth instead of passwords
- **Faster onboarding** - One-click authentication
- **Professional UX** - Clean Google sign-in flow

The app is now ready for production with Google authentication! 🏎️✨
