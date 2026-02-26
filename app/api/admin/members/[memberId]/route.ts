import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type CombinedRole = 'Admin' | 'Officer' | 'Student' | 'Staff' | 'Visitor';

async function assertAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: adminRole, error: roleError } = await supabase
    .from('school_operator_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('operator_role', 'Admin')
    .eq('is_active', true)
    .maybeSingle();

  if (roleError || !adminRole) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId: user.id };
}

function isPromotedOperatorRole(role: CombinedRole) {
  return role === 'Admin' || role === 'Officer';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const access = await assertAdminAccess();

  if ('error' in access) {
    return access.error;
  }

  const actorId = access.userId;
  const { memberId } = await params;

  if (memberId === actorId) {
    return NextResponse.json({ error: 'You cannot modify your own account from this page.' }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const payload = (await request.json()) as { action?: 'set-role' | 'deactivate'; role?: CombinedRole };

  const { data: targetAuthUser, error: targetError } = await adminClient
    .from('auth_users')
    .select('id, person_id, role_id')
    .eq('id', memberId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  if (!targetAuthUser) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  const { data: person, error: personError } = await adminClient
    .from('person_registry')
    .select('id, person_type, is_active')
    .eq('id', targetAuthUser.person_id)
    .maybeSingle();

  if (personError) {
    return NextResponse.json({ error: personError.message }, { status: 500 });
  }

  if (!person) {
    return NextResponse.json({ error: 'Person record not found.' }, { status: 404 });
  }

  if (payload.action === 'deactivate') {
    const [{ error: deactivatePersonError }, { error: deactivateRoleError }, authBanResult] = await Promise.all([
      adminClient.from('person_registry').update({ is_active: false }).eq('id', person.id),
      adminClient.from('school_operator_roles').update({ is_active: false }).eq('user_id', memberId),
      adminClient.auth.admin.updateUserById(memberId, { ban_duration: '876000h' }),
    ]);

    if (deactivatePersonError) {
      return NextResponse.json({ error: deactivatePersonError.message }, { status: 500 });
    }

    if (deactivateRoleError) {
      return NextResponse.json({ error: deactivateRoleError.message }, { status: 500 });
    }

    if (authBanResult.error) {
      return NextResponse.json({ error: authBanResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Member account deactivated.' });
  }

  if (payload.action !== 'set-role' || !payload.role) {
    return NextResponse.json({ error: 'Invalid action payload.' }, { status: 400 });
  }

  const selectedRole = payload.role;

  if (isPromotedOperatorRole(selectedRole) && person.person_type !== 'Staff') {
    return NextResponse.json(
      {
        error: 'Only members with Staff base role can be promoted to Admin or Officer.',
      },
      { status: 400 }
    );
  }

  if (selectedRole === 'Admin' || selectedRole === 'Officer') {
    const operatorRole = selectedRole === 'Admin' ? 'Admin' : 'Taker';

    const { data: upsertedRole, error: upsertRoleError } = await adminClient
      .from('school_operator_roles')
      .upsert(
        {
          user_id: memberId,
          operator_role: operatorRole,
          is_active: true,
          assigned_by: actorId,
          assigned_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single();

    if (upsertRoleError || !upsertedRole) {
      return NextResponse.json({ error: upsertRoleError?.message ?? 'Failed to set operator role.' }, { status: 500 });
    }

    const [{ error: updateAuthUsersError }, unbanResult] = await Promise.all([
      adminClient.from('auth_users').update({ role_id: upsertedRole.id }).eq('id', memberId),
      adminClient.auth.admin.updateUserById(memberId, { ban_duration: 'none' }),
    ]);

    if (updateAuthUsersError) {
      return NextResponse.json({ error: updateAuthUsersError.message }, { status: 500 });
    }

    if (unbanResult.error) {
      return NextResponse.json({ error: unbanResult.error.message }, { status: 500 });
    }

    if (!person.is_active) {
      const { error: activatePersonError } = await adminClient
        .from('person_registry')
        .update({ is_active: true })
        .eq('id', person.id);

      if (activatePersonError) {
        return NextResponse.json({ error: activatePersonError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: `Role updated to ${selectedRole}.` });
  }

  const [{ error: updatePersonError }, { error: clearOperatorError }, { error: updateAuthUsersError }, unbanResult] =
    await Promise.all([
      adminClient
        .from('person_registry')
        .update({ person_type: selectedRole, is_active: true })
        .eq('id', person.id),
      adminClient.from('school_operator_roles').update({ is_active: false }).eq('user_id', memberId),
      adminClient.from('auth_users').update({ role_id: null }).eq('id', memberId),
      adminClient.auth.admin.updateUserById(memberId, { ban_duration: 'none' }),
    ]);

  if (updatePersonError) {
    return NextResponse.json({ error: updatePersonError.message }, { status: 500 });
  }

  if (clearOperatorError) {
    return NextResponse.json({ error: clearOperatorError.message }, { status: 500 });
  }

  if (updateAuthUsersError) {
    return NextResponse.json({ error: updateAuthUsersError.message }, { status: 500 });
  }

  if (unbanResult.error) {
    return NextResponse.json({ error: unbanResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Role updated to ${selectedRole}.` });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const access = await assertAdminAccess();

  if ('error' in access) {
    return access.error;
  }

  const actorId = access.userId;
  const { memberId } = await params;

  if (memberId === actorId) {
    return NextResponse.json({ error: 'You cannot delete your own account from this page.' }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: targetAuthUser, error: targetError } = await adminClient
    .from('auth_users')
    .select('id, person_id')
    .eq('id', memberId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: targetError.message }, { status: 500 });
  }

  if (!targetAuthUser) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(memberId);

  if (deleteAuthError) {
    return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
  }

  const { error: deletePersonError } = await adminClient
    .from('person_registry')
    .delete()
    .eq('id', targetAuthUser.person_id);

  if (deletePersonError) {
    return NextResponse.json({ error: deletePersonError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Member account permanently deleted.' });
}
