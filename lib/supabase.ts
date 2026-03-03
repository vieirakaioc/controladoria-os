import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jovibfyswqndgxrfafrh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdmliZnlzd3FuZGd4cmZhZnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzAwMzQsImV4cCI6MjA4ODA0NjAzNH0.laRw1M5mXx9ttT0PYzn275lOyVJ11XxZ94IaWYCiPbU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)