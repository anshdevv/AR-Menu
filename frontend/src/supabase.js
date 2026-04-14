import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://gcayyillaaxyuxpxhxln.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjYXl5aWxsYWF4eXV4cHhoeGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTk2NTYsImV4cCI6MjA5MDc5NTY1Nn0.h4U_11nC0rJGDtIlh0ejk41q_mKQ_3Hq-4tYQdkO9UI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
