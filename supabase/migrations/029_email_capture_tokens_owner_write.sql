-- Allow authenticated managers to mint/update their own capture tokens from the dashboard.
-- Netlify service role bypasses RLS; this is for browser Supabase client.

create policy "email_capture_tokens: owner insert"
  on public.email_capture_tokens
  for insert
  with check (auth.uid() = user_id);

create policy "email_capture_tokens: owner update"
  on public.email_capture_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
