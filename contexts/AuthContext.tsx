'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Taker';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string, role: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(user: SupabaseUser): User {
  const email = user.email ?? '';
  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined;

  return {
    id: user.id,
    email,
    name: fullName || email || 'User',
    role: email.endsWith('@school.edu') ? 'Admin' : 'Taker',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      if (!error && data.user) {
        setUser(mapSupabaseUser(data.user));
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) {
        return;
      }

      if (session?.user) {
        setUser(mapSupabaseUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('====== LOGIN PROCESS STARTED ======');
    console.log('Attempting to login with email:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error('❌ LOGIN FAILED');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      if (error.message.includes('Invalid login credentials')) {
        console.error('Possible causes:');
        console.error('- Wrong email or password');
        console.error('- User does not exist in auth.users table');
        console.error('- Email not confirmed (if confirmation is enabled)');
      }
      
      return false;
    }
    
    if (data.user) {
      console.log('✅ LOGIN SUCCESS');
      console.log('User ID:', data.user.id);
      console.log('User email:', data.user.email);
      console.log('Session expires at:', data.session?.expires_at);
      console.log('====== LOGIN PROCESS COMPLETED ======');
    }
    
    return !error;
  };


  const signup = async (email: string, password: string, firstName: string, lastName: string, role: string): Promise<boolean> => {
    console.log('====== SIGNUP PROCESS STARTED ======');
    console.log('Step 1: Preparing to create auth user with email:', email);
    
    try {
      // Create auth user
      console.log('Step 2: Calling supabase.auth.signUp()...');
      const { data: { user: authUser }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            role,
          },
        },
      });

      if (signUpError) {
        console.error('❌ Step 2 FAILED: Supabase auth signup error:', signUpError);
        console.error('Error details:', JSON.stringify(signUpError, null, 2));
        return false;
      }

      if (!authUser) {
        console.error('❌ Step 2 FAILED: No user returned from signup');
        return false;
      }

      console.log('✅ Step 2 SUCCESS: Auth user created');
      console.log('Auth user ID:', authUser.id);
      console.log('Auth user email:', authUser.email);
      console.log('Auth user confirmed:', authUser.confirmed_at ? 'Yes' : 'No (email confirmation required)');
      
      // Check if email confirmation is required
      if (!authUser.confirmed_at) {
        console.warn('⚠️ WARNING: Email confirmation is required!');
        console.warn('The user will need to confirm their email before being able to login.');
        console.warn('Consider disabling email confirmation in Supabase > Authentication > Email Auth settings');
        console.warn('Set "Confirm email" to OFF for development');
      }

      // Add a small delay to ensure auth.users record is committed
      console.log('Waiting for auth transaction to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create person_registry entry using SECURITY DEFINER function
      // This bypasses RLS and works for new user registration
      console.log('Step 3: Creating person_registry entry via RPC...');
      console.log('Data to insert:', {
        full_name: `${firstName} ${lastName}`,
        email: email,
        person_type: role,
      });
      
      const { data: personId, error: personError } = await supabase
        .rpc('create_person_registry_record', {
          user_full_name: `${firstName} ${lastName}`,
          user_email: email,
          user_person_type: role
        });

      if (personError) {
        console.error('❌ Step 3 FAILED: Person registry creation error');
        console.error('Error code:', personError.code);
        console.error('Error message:', personError.message);
        console.error('Error details:', JSON.stringify(personError, null, 2));
        console.error('This might be due to missing required fields or RLS policies');
        return false; // Must have person_registry entry to continue
      }

      if (!personId) {
        console.error('❌ Step 3 FAILED: No person ID returned from RPC');
        return false;
      }

      console.log('✅ Step 3 SUCCESS: Person registry created');
      console.log('Person ID:', personId);

      // Get or find the role in school_operator_roles (optional)
      console.log('Step 4: Looking up role in school_operator_roles...');
      let roleId: string | null = null;
      
      // Try to find matching role, but don't fail if not found
      try {
        const { data: allRoles, error: roleError } = await supabase
          .from('school_operator_roles')
          .select('id')
          .limit(1);

        if (roleError) {
          console.warn('⚠️ Step 4 WARNING: Error fetching roles:', roleError);
          console.warn('Continuing without role_id...');
        } else if (allRoles && allRoles.length > 0) {
          roleId = allRoles[0].id;
          console.log('✅ Step 4 SUCCESS: Role found:', roleId);
        } else {
          console.log('⚠️ Step 4 WARNING: No roles found in school_operator_roles table');
          console.log('Continuing with null role_id...');
        }
      } catch (error) {
        console.error('⚠️ Step 4 WARNING: Exception while fetching roles:', error);
        console.log('Continuing with null role_id...');
      }

      // Create auth_users bridge entry using SECURITY DEFINER function
      console.log('Step 5: Creating auth_users bridge record via RPC...');
      const rpcParams = {
        user_id: authUser.id,
        person_uuid: personId,
        user_email: email,
        user_role_id: roleId
      };
      console.log('RPC parameters:', rpcParams);

      const { error: authUsersError } = await supabase
        .rpc('create_auth_users_record', rpcParams);

      if (authUsersError) {
        console.error('❌ Step 5 FAILED: Auth users creation error');
        console.error('Error code:', authUsersError.code);
        console.error('Error message:', authUsersError.message);
        console.error('Error details:', JSON.stringify(authUsersError, null, 2));
        console.error('Possible causes:');
        console.error('- RPC function not found or not granted permissions');
        console.error('- Foreign key constraint violation');
        console.error('- RLS policy blocking insert');
        return false; // Must have auth_users entry to login
      }

      console.log('✅ Step 5 SUCCESS: Auth users record created via RPC');
      console.log('====== SIGNUP PROCESS COMPLETED SUCCESSFULLY ======');
      console.log('Summary:');
      console.log('- Auth User ID:', authUser.id);
      console.log('- Person Registry ID:', personId);
      console.log('- Email:', email);
      console.log('- Role ID:', roleId || 'None');

      return true;
    } catch (error) {
      console.error('❌ SIGNUP PROCESS FAILED WITH EXCEPTION');
      console.error('Uncaught error:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return false;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    return !error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
