-- Migration 06: Admin RLS policies for gates management
-- Allows admins to insert new gates and toggle is_active

create policy "Admins can insert gates"
  on public.gates
  for insert
  with check (has_school_operator_role(auth.uid(), 'Admin'));

create policy "Admins can update gates"
  on public.gates
  for update
  using (has_school_operator_role(auth.uid(), 'Admin'));
