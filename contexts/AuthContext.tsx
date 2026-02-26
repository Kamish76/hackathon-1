'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User as SupabaseUser, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Student' | 'Staff' | 'Visitor' | 'Special Guest' | 'Officer';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string, role: string) => Promise<boolean>;
  completeOAuthProfile: (firstName: string, lastName: string, role: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(
  user: SupabaseUser,
  personRegistryFullName?: string,
  personRole?: User['role'],
): User {
  const email = user.email ?? '';
  // Prefer person_registry full_name over Google metadata
  const fullName = personRegistryFullName || (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : undefined);

  console.log('🔵 mapSupabaseUser called:');
  console.log('- personRegistryFullName:', personRegistryFullName);
  console.log('- user.user_metadata?.full_name:', user.user_metadata?.full_name);
  console.log('- Final fullName:', fullName);
  console.log('- personRole:', personRole);

  return {
    id: user.id,
    email,
    name: fullName || email || 'User',
    role: personRole ?? 'Officer',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;
    console.log('[AuthContext] Initializing auth state...');

    const verifyUserInAuthUsers = async (userId: string, userEmail: string): Promise<{ verified: boolean; personRegistryFullName?: string; personRole?: User['role'] }> => {
      console.log('🔵 Verifying user in auth_users table...');
      
      try {
        const { data: authUser, error: authUserError } = await supabase
          .from('auth_users')
          .select('id, person_id')
          .eq('id', userId)
          .single();

        console.log('Auth Users Verification:');
        console.log('- Error:', authUserError);
        console.log('- Data:', authUser);

        // Check for PGRST116 (no rows) specifically - this means user doesn't exist yet
        if (authUserError) {
          if (authUserError.code === 'PGRST116' || authUserError.message?.includes('no rows')) {
            console.log('❌ User not found in auth_users (no rows), redirecting to complete profile');
            router.push(`/auth/registration?oauth=true&email=${encodeURIComponent(userEmail)}`);
            return { verified: false };
          }
          // For other errors (like 500), log but don't redirect - might be temporary
          console.error('⚠️ Error checking auth_users:', authUserError);
          return { verified: true }; // Allow access despite error to prevent blocking
        }

        if (!authUser || !authUser.person_id) {
          console.log('❌ User record incomplete in auth_users, redirecting to complete profile');
          router.push(`/auth/registration?oauth=true&email=${encodeURIComponent(userEmail)}`);
          return { verified: false };
        }

        // Now fetch the person_registry full_name using RPC function
        console.log('🔵 Fetching person_registry full_name via RPC...');
        
        // Try to get full_name with a timeout
        let fullName: string | null = null;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const { data, error: personError } = await supabase
            .rpc('get_person_full_name', { user_id: userId });
          
          clearTimeout(timeoutId);
          
          if (!personError && data) {
            fullName = data;
            console.log('✅ Successfully fetched person_registry full_name:', fullName);
          } else if (personError) {
            console.warn('⚠️ RPC error (function may not exist yet):', personError?.message);
          }
        } catch (error) {
          console.warn('⚠️ RPC call failed:', error instanceof Error ? error.message : error);
        }

        // Fetch role via SECURITY DEFINER RPC functions (bypasses RLS on school_operator_roles)
        let personRole: User['role'] = 'Officer';
        try {
          const { data: isAdmin } = await supabase.rpc('has_school_operator_role', {
            p_user_id: userId,
            p_role: 'Admin',
          });

          if (isAdmin) {
            personRole = 'Admin';
            console.log('✅ User has Admin role');
          } else {
            const { data: isOfficer } = await supabase.rpc('has_school_operator_role', {
              p_user_id: userId,
              p_role: 'Officer',
            });

            if (isOfficer) {
              personRole = 'Officer';
              console.log('✅ User has Officer role');
            } else {
              // Fetch person_type from person_registry
              const { data: personRecord } = await supabase
                .from('person_registry')
                .select('person_type')
                .eq('id', authUser.person_id)
                .maybeSingle();

              if (personRecord?.person_type) {
                personRole = personRecord.person_type as User['role'];
                console.log('✅ Person type from registry:', personRole);
              }
            }
          }
        } catch (roleError) {
          console.warn('⚠️ Could not fetch role, defaulting to Officer:', roleError);
        }

        console.log('✅ User verified in auth_users');
        return { verified: true, personRegistryFullName: fullName || undefined, personRole };
      } catch (error) {
        console.error('⚠️ Exception checking auth_users:', error);
        return { verified: true }; // Allow access despite error
      }
    };

    const applySessionUser = async (sessionUser: SupabaseUser | null) => {
      console.log('[AuthContext] applySessionUser called', {
        hasSessionUser: Boolean(sessionUser),
        userId: sessionUser?.id ?? null,
        email: sessionUser?.email ?? null,
      });

      if (!mounted) {
        console.log('[AuthContext] Component unmounted; skipping applySessionUser');
        return;
      }

      if (!sessionUser) {
        console.log('[AuthContext] No session user; setting user=null');
        setUser(null);
        return;
      }

      const result = await verifyUserInAuthUsers(sessionUser.id, sessionUser.email || '');
      if (result.verified && mounted) {
        console.log('[AuthContext] Session user verified, mapping user state');
        setUser(mapSupabaseUser(sessionUser, result.personRegistryFullName, result.personRole));
      } else {
        console.log('[AuthContext] Session user not verified; keeping user state null');
      }
    };

    const initializeAuth = async () => {
      try {
        console.log('[AuthContext] Calling supabase.auth.getSession()');
        const { data, error } = await supabase.auth.getSession();

        console.log('[AuthContext] getSession result', {
          hasError: Boolean(error),
          hasSession: Boolean(data.session),
          userId: data.session?.user?.id ?? null,
        });

        if (!error && data.session?.user) {
          await applySessionUser(data.session.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthContext] initializeAuth failed:', error);
        setUser(null);
      }

      if (mounted) {
        console.log('[AuthContext] Initialization completed; setting isLoading=false');
        setIsLoading(false);
      }
    };

    void initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      console.log('[AuthContext] onAuthStateChange fired', {
        event: _event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      if (!mounted) {
        console.log('[AuthContext] Component unmounted; skipping auth state change');
        return;
      }

      void applySessionUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      console.log('[AuthContext] Cleaning up auth listener');
      authListener.subscription.unsubscribe();
    };
  }, [supabase, router]);

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

  const completeOAuthProfile = async (firstName: string, lastName: string, role: string): Promise<boolean> => {
    console.log('====== OAUTH PROFILE COMPLETION STARTED ======');
    
    try {
      // Get current authenticated user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !authUser) {
        console.error('❌ No authenticated user found');
        return false;
      }

      console.log('✅ Authenticated user:', authUser.id);
      console.log('Email:', authUser.email);

      // Add delay to ensure auth.users record is committed
      console.log('Waiting for auth transaction to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create person_registry entry using SECURITY DEFINER function
      console.log('Step 1: Creating person_registry entry via RPC...');
      const { data: personId, error: personError } = await supabase
        .rpc('create_person_registry_record', {
          user_full_name: `${firstName} ${lastName}`,
          user_email: authUser.email!,
          user_person_type: role
        });

      if (personError || !personId) {
        console.error('❌ Step 1 FAILED: Person registry creation error');
        console.error('Error details:', JSON.stringify(personError, null, 2));
        return false;
      }

      console.log('✅ Step 1 SUCCESS: Person registry created');
      console.log('Person ID:', personId);

      // Get or find the role in school_operator_roles (optional)
      console.log('Step 2: Looking up role in school_operator_roles...');
      let roleId: string | null = null;
      
      try {
        const { data: allRoles, error: roleError } = await supabase
          .from('school_operator_roles')
          .select('id')
          .limit(1);

        if (roleError) {
          console.warn('⚠️ Step 2 WARNING: Error fetching roles:', roleError);
        } else if (allRoles && allRoles.length > 0) {
          roleId = allRoles[0].id;
          console.log('✅ Step 2 SUCCESS: Role found:', roleId);
        } else {
          console.log('⚠️ Step 2 WARNING: No roles found');
        }
      } catch (error) {
        console.error('⚠️ Step 2 WARNING: Exception:', error);
      }

      // Create auth_users bridge entry
      console.log('Step 3: Creating auth_users bridge record via RPC...');
      const { error: authUsersError } = await supabase
        .rpc('create_auth_users_record', {
          user_id: authUser.id,
          person_uuid: personId,
          user_email: authUser.email!,
          user_role_id: roleId
        });

      if (authUsersError) {
        console.error('❌ Step 3 FAILED: Auth users creation error');
        console.error('Error details:', JSON.stringify(authUsersError, null, 2));
        return false;
      }

      console.log('✅ Step 3 SUCCESS: Auth users record created');
      console.log('====== OAUTH PROFILE COMPLETION COMPLETED SUCCESSFULLY ======');

      return true;
    } catch (error) {
      console.error('❌ OAUTH PROFILE COMPLETION FAILED WITH EXCEPTION');
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
    <AuthContext.Provider value={{ user, isLoading, login, signup, completeOAuthProfile, loginWithGoogle, logout }}>
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
