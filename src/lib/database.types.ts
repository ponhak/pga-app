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
        Row: { id: string; date: string; group_size: number; notes: string | null; created_at: string }
        Insert: { id?: string; date?: string; group_size: number; notes?: string | null; created_at?: string }
        Update: { id?: string; date?: string; group_size?: number; notes?: string | null; created_at?: string }
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
        Row: { id: string; round_id: string; player_id: string; strokes: number | null; points_earned: number | null; rank: number | null }
        Insert: { id?: string; round_id: string; player_id: string; strokes?: number | null; points_earned?: number | null; rank?: number | null }
        Update: { id?: string; round_id?: string; player_id?: string; strokes?: number | null; points_earned?: number | null; rank?: number | null }
      }
    }
  }
}

export type Player = Database['public']['Tables']['players']['Row']
export type Round = Database['public']['Tables']['rounds']['Row']
export type Score = Database['public']['Tables']['scores']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
