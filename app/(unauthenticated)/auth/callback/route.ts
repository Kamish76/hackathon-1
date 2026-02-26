  import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  console.log('🔵 OAuth Callback Hit!');
  console.log('Code:', code ? 'present' : 'missing');
  console.log('Next:', next);

  const supabase = await createClient();
  let currentUser = null;

  if (code) {
    try {
      console.log('🔵 Exchanging code for session...');
      const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('❌ Code exchange failed:', error);
        return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=oauth_failed`);
      }

      console.log('✅ Code exchange successful');
      console.log('User ID:', sessionData.user?.id);
      console.log('User Email:', sessionData.user?.email);
      currentUser = sessionData.user;
    } catch (error) {
      console.error('OAuth callback error:', error);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=oauth_failed`);
    }
  } else {
    // No code provided, check if there's an existing session
    console.log('🔵 No code provided, checking for existing session...');
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.log('❌ No existing session found, redirecting to login');
        return NextResponse.redirect(`${requestUrl.origin}/auth/login`);
      }
      
      console.log('✅ Found existing session');
      console.log('User ID:', user.id);
      console.log('User Email:', user.email);
      currentUser = user;
    } catch (error) {
      console.error('Error checking session:', error);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login`);
    }
  }

  // Check if user exists in auth_users table
  if (currentUser) {
    console.log('🔵 Verifying user in auth_users table');
    
    try {
      const { data: authUser, error: authUserError } = await supabase
        .from('auth_users')
        .select('id, person_id')
        .eq('id', currentUser.id)
        .single();

      console.log('Auth Users Query Result:');
      console.log('- Error:', authUserError);
      console.log('- Data:', authUser);

      // If user doesn't exist in auth_users, redirect to registration completion
      if (authUserError || !authUser || !authUser.person_id) {
        console.log('❌ OAuth user not found in auth_users, redirecting to complete registration');
        const redirectUrl = `${requestUrl.origin}/auth/registration?oauth=true&email=${encodeURIComponent(currentUser.email || '')}`;
        console.log('Redirect URL:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
      }

      console.log('✅ OAuth user verified in auth_users, proceeding to dashboard');
    } catch (error) {
      console.error('Error verifying user:', error);
      return NextResponse.redirect(`${requestUrl.origin}/auth/login?error=verification_failed`);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
