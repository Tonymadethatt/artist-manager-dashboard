/** Supabase embed for task rows (keep in sync with `useTasks`). */
export const TASK_LIST_SELECT = `
  *,
  venue:venues(id, name),
  deal:deals(id, description),
  agreement_file:generated_files!tasks_generated_file_id_fkey(id, name),
  lead:leads!tasks_lead_fkey(id, venue_name, folder_id),
  lead_folder:lead_folders!tasks_lead_folder_fkey(id, name)
`
