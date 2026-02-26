import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type PersonType = 'Student' | 'Staff' | 'Visitor' | 'Special Guest';
type OperatorRole = 'Admin' | 'Officer' | 'Taker';
type CombinedRole = 'Admin' | 'Officer' | 'Student' | 'Staff' | 'Visitor';

function toCombinedRole(personType: PersonType, operatorRole: OperatorRole | null): CombinedRole {
  if (operatorRole === 'Admin') {
    return 'Admin';
  }

  if (operatorRole === 'Officer' || operatorRole === 'Taker') {
    return 'Officer';
  }

  if (personType === 'Special Guest') {
    return 'Visitor';
  }

  return personType;
}

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

export async function GET(request: NextRequest) {
  const access = await assertAdminAccess();

  if ('error' in access) {
    return access.error;
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server configuration error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const searchQuery = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';

  const { data: authUsers, error: authUsersError } = await adminClient
    .from('auth_users')
    .select('id, email, person_id, role_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (authUsersError) {
    return NextResponse.json({ error: authUsersError.message }, { status: 500 });
  }

  const personIds = (authUsers ?? []).map((item) => item.person_id).filter(Boolean);
  const userIds = (authUsers ?? []).map((item) => item.id);

  const [{ data: people, error: peopleError }, { data: operatorRoles, error: operatorRolesError }] =
    await Promise.all([
      personIds.length
        ? adminClient
            .from('person_registry')
            .select('id, full_name, person_type, is_active')
            .in('id', personIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? adminClient
            .from('school_operator_roles')
            .select('id, user_id, operator_role, is_active')
            .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (peopleError) {
    return NextResponse.json({ error: peopleError.message }, { status: 500 });
  }

  if (operatorRolesError) {
    return NextResponse.json({ error: operatorRolesError.message }, { status: 500 });
  }

  const peopleById = new Map((people ?? []).map((person) => [person.id, person]));
  const roleByUserId = new Map((operatorRoles ?? []).map((role) => [role.user_id, role]));

  const members = (authUsers ?? [])
    .map((authUser) => {
      const person = peopleById.get(authUser.person_id);

      if (!person) {
        return null;
      }

      const roleRecord = roleByUserId.get(authUser.id);
      const activeOperatorRole = roleRecord?.is_active ? (roleRecord.operator_role as OperatorRole) : null;

      return {
        id: authUser.id,
        email: authUser.email,
        fullName: person.full_name,
        personType: person.person_type,
        personId: person.id,
        operatorRole: activeOperatorRole,
        role: toCombinedRole(person.person_type as PersonType, activeOperatorRole),
        isActive: person.is_active,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const filteredMembers = searchQuery
    ? members.filter((member) => {
        const haystack = `${member.fullName} ${member.email} ${member.personType} ${member.role}`.toLowerCase();
        return haystack.includes(searchQuery);
      })
    : members;

  return NextResponse.json({ members: filteredMembers });
}
