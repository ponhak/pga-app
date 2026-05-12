export interface Database {
  public: {
    Tables: {
      allowed_emails: {
        Row: { email: string; added_at: string }
        Insert: { email: string; added_at?: string }
        Update: { email?: string; added_at?: string }
      }
      profiles: {
        Row: { id: string; name: string; phone: string | null }
        Insert: { id: string; name: string; phone?: string | null }
        Update: { id?: string; name?: string; phone?: string | null }
      }
      players: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
      }
      rounds: {
        Row: { id: string; date: string; group_size: number; notes: string | null; tee_time: string | null; double_points: boolean; created_at: string }
        Insert: { id?: string; date?: string; group_size: number; notes?: string | null; tee_time?: string | null; double_points?: boolean; created_at?: string }
        Update: { id?: string; date?: string; group_size?: number; notes?: string | null; tee_time?: string | null; double_points?: boolean; created_at?: string }
      }
      season_plans: {
        Row: { id: string; year: number; max_field_size: number; total_rounds: number; status: string; created_at: string }
        Insert: { id?: string; year: number; max_field_size: number; total_rounds: number; status?: string; created_at?: string }
        Update: { id?: string; year?: number; max_field_size?: number; total_rounds?: number; status?: string; created_at?: string }
      }
      season_plan_rounds: {
        Row: { id: string; plan_id: string; round_number: number; name: string; date: string | null; double_points: boolean; round_id: string | null }
        Insert: { id?: string; plan_id: string; round_number: number; name?: string; date?: string | null; double_points?: boolean; round_id?: string | null }
        Update: { id?: string; plan_id?: string; round_number?: number; name?: string; date?: string | null; double_points?: boolean; round_id?: string | null }
      }
      round_players: {
        Row: { round_id: string; player_id: string }
        Insert: { round_id: string; player_id: string }
        Update: { round_id: string; player_id: string }
      }
      groups: {
        Row: { id: string; round_id: string; group_number: number }
        Insert: { id?: string; round_id: string; group_number: number }
        Update: { id?: string; round_id?: string; group_number?: number }
      }
      group_members: {
        Row: { group_id: string; player_id: string }
        Insert: { group_id: string; player_id: string }
        Update: { group_id: string; player_id: string }
      }
      scores: {
        Row: { id: string; round_id: string; player_id: string; strokes: number | null; gross_strokes: number | null; net_diff: number | null; points_earned: number | null; rank: number | null; dnf: boolean }
        Insert: { id?: string; round_id: string; player_id: string; strokes?: number | null; gross_strokes?: number | null; net_diff?: number | null; points_earned?: number | null; rank?: number | null; dnf?: boolean }
        Update: { id?: string; round_id?: string; player_id?: string; strokes?: number | null; gross_strokes?: number | null; net_diff?: number | null; points_earned?: number | null; rank?: number | null; dnf?: boolean }
      }
    }
  }
}

export type Player = Database['public']['Tables']['players']['Row']
export type Round = Database['public']['Tables']['rounds']['Row']
export type Score = Database['public']['Tables']['scores']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
