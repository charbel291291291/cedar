# Google OAuth Setup Guide for CedarBoost

This guide will walk you through enabling Google Sign-In for your CedarBoost application.

## 📋 Prerequisites

- Supabase project with authentication enabled
- Google Cloud Platform account (free tier works fine)
- Your CedarBoost app running locally or deployed

---

## 🔧 Step 1: Configure Google Cloud Console

### 1.1 Create a New Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"NEW PROJECT"**
3. Name it `CedarBoost` (or any name you prefer)
4. Click **"CREATE"**

### 1.2 Enable Google+ API
1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for **"Google+ API"**
3. Click on it and press **"ENABLE"**

### 1.3 Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure the **OAuth consent screen**:
   - User Type: **External**
   - App name: **CedarBoost**
   - User support email: Your email
   - Developer contact: Your email
   - Click **"SAVE AND CONTINUE"**
   - Scopes: Skip this step
   - Test users: Add your email for testing
   - Click **"BACK TO DASHBOARD"**

4. Back to **Create OAuth Client ID**:
   - Application type: **Web application**
   - Name: `CedarBoost Web Client`
   
5. **Add Authorized JavaScript origins**:
   ```
   http://localhost:8081          (for local development)
   https://your-domain.com        (for production - add your actual domain)
   ```

6. **Add Authorized redirect URIs**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Replace `YOUR_PROJECT_REF` with your Supabase project reference (found in Supabase dashboard)

7. Click **"CREATE"**

8. **Copy the credentials**:
   - **Client ID** (looks like: `123456789-abc123def456.apps.googleusercontent.com`)
   - **Client Secret** (looks like: `GOCSPX-abc123def456`)

---

## ⚙️ Step 2: Configure Supabase

### 2.1 Enable Google Provider
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and click **"Enable"**

### 2.2 Add Google Credentials
In the Google provider settings:
- **Client ID**: Paste the Client ID from Google Cloud Console
- **Client Secret**: Paste the Client Secret from Google Cloud Console
- **Redirect URL**: Should already be filled with:
  ```
  https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
  ```
- Toggle **"Enable"** to ON
- Click **"Save"**

---

## 🌐 Step 3: Update Environment Variables

Make sure your `.env` file has the correct configuration:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These should already be configured. No changes needed unless you're using a different project.

---

## 🧪 Step 4: Test Google Sign-In

### 4.1 Run Your Application Locally
```bash
npm run dev
```

Your app should be running at `http://localhost:8081`

### 4.2 Test the Flow
1. Navigate to the auth page: `http://localhost:8081/auth`
2. You should see a **"Sign in with Google"** button below the email/password form
3. Click the button
4. Google will open in a popup/new window asking you to sign in
5. After successful authentication, you'll be redirected back to `/auth`
6. You should be logged in and redirected to `/dashboard`

---

## 🎨 UI Features Added

The Google Sign-In integration includes:

✅ **Styled Button**: Matches your CedarBoost design system
- Rounded corners (`rounded-2xl`)
- Glass morphism effect (`bg-white/5`)
- Hover effects and animations
- Chrome icon from Lucide React

✅ **Responsive Design**: Works on all device sizes
- Mobile-first approach
- Proper touch targets
- Smooth animations

✅ **Bilingual Support**: English and Arabic translations
- "Sign in with Google" / "تسجيل الدخول باستخدام Google"
- "or continue with" / "أو تابع باستخدام"

✅ **Error Handling**: Graceful error messages if authentication fails

---

## 🔒 Security Best Practices

### Production Checklist:
- ✅ Only add production domains to Google Cloud Console authorized origins
- ✅ Never commit Client Secret to version control
- ✅ Use environment variables for sensitive data
- ✅ Consider adding reCAPTCHA protection if needed
- ✅ Monitor authentication logs in Supabase dashboard

---

## 🐛 Troubleshooting

### Issue: "redirect_uri_mismatch" Error
**Solution**: Make sure the redirect URI in Google Cloud Console exactly matches:
```
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

### Issue: Button Not Working
**Check**:
1. Is your Supabase project URL correct in `.env`?
2. Is the Google provider enabled in Supabase?
3. Check browser console for errors
4. Verify the Client ID and Secret are correct

### Issue: "Access Blocked" from Google
**Solution**: 
- Your app might be in "Testing" mode
- Add your test email to the Google Cloud Console under "Test users"
- Or publish the OAuth consent screen when ready

### Issue: Redirect Loop After Login
**Check**:
1. Verify your `redirectTo` URL in the auth code matches your actual domain
2. Check Supabase Auth settings for allowed redirect URLs
3. Clear browser cache and cookies

---

## 📊 Monitoring & Analytics

Track Google Sign-In usage:

1. **Supabase Dashboard** → **Authentication** → **Users**
   - See all users who signed up via Google
   
2. **Supabase Logs** → **Auth Logs**
   - Monitor authentication events
   
3. **Google Cloud Console** → **APIs & Services** → **Dashboard**
   - Track API usage

---

## 🎉 Success Indicators

You'll know everything is working when:

✅ Users can click "Sign in with Google"  
✅ Google authentication popup appears  
✅ After signing in, user is redirected back to your app  
✅ User appears in Supabase dashboard with `google` as provider  
✅ User can access protected routes (dashboard, orders, etc.)  

---

## 📱 Next Steps

After confirming Google Sign-In works:

1. **Customize the OAuth Consent Screen** with your branding
2. **Add more providers** (GitHub, Facebook, Discord, etc.)
3. **Implement social login incentives** (e.g., bonus credits for first Google sign-in)
4. **Set up analytics** to track which auth method users prefer
5. **Add account linking** (merge email + Google accounts with same email)

---

## 🆘 Need Help?

- **Supabase Docs**: https://supabase.com/docs/guides/auth/social-login/auth-google
- **Google OAuth Docs**: https://developers.google.com/identity/protocols/oauth2
- **Your Code**: Check `src/hooks/useAuth.tsx` and `src/pages/Auth.tsx`

---

**Happy Coding! 🚀**
