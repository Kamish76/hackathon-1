# Database Setup Instructions

To enable user registration data to be recorded in the database with integration to your existing schema, follow these steps:

## Step 1: Run the Migration in Supabase

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to the **SQL Editor** section
3. Click **New Query**
4. Copy the contents of `supabase/migrations/01_create_users_table.sql` and paste it into the query editor
5. Click **Run** to execute the migration

This will create:
- An `auth_users` bridge table that links Supabase auth with your existing `person_registry` and `school_operator_roles` tables
- Row Level Security (RLS) policies for data access control
- An automatic trigger to update the `updated_at` timestamp

## Step 2: Verify Table Structure

The schema creates these relationships:
- `auth_users.id` → `auth.users(id)` (Supabase authentication)
- `auth_users.person_id` → `person_registry(id)` (Existing person records)
- `auth_users.role_id` → `school_operator_roles(id)` (Role assignments)

## Step 3: Enable Row Level Security

The schema includes Row Level Security policies:
- Users can only read and update their own auth record
- Admins can read all auth records
- Users can insert their own auth record during signup

## Step 4: Verify Setup

To verify the tables were created correctly:
1. In Supabase dashboard, go to **Table Editor**
2. You should see an `auth_users` table in the list
3. The table should have columns: `id`, `person_id`, `email`, `role_id`, `created_at`, `updated_at`

## Registration Flow

When a user registers with email/password:
1. **Supabase Auth** creates an entry in `auth.users` (managed by Supabase)
2. **person_registry** creates a new person record
3. **auth_users** bridges the auth user with the person record and assigns a role
4. User can now access the application alongside existing person_registry data

## Integration with Existing Schema

The new `auth_users` table integrates seamlessly with your existing structure:
- Existing `person_registry` entries can be linked to auth users via `auth_users.person_id`
- Role management stays consistent with `school_operator_roles`
- All access events and vehicle sessions continue to reference `person_registry.id`

## Troubleshooting

If registration fails:
- Check the browser console for error messages
- Verify your Supabase URL and anon key are correct in `.env.local`
- Make sure the migration SQL was executed successfully
- Verify `person_registry` and `school_operator_roles` tables exist and have appropriate roles
- Check that RLS is properly configured for writes
- Ensure your Supabase project allows new user signups

## Important Notes

- You may need to add additional columns to the INSERT statement if your `person_registry` has required fields
- Update the role lookup in `contexts/AuthContext.tsx` if your role names differ (currently expects 'Admin' or 'Taker')
- The `person_id` can be null initially if person_registry creation fails, allowing auth to proceed
