export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'team_leader' | 'operator'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'admin' | 'team_leader' | 'operator'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'team_leader' | 'operator'
          created_at?: string
          updated_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string
          created_at?: string
          created_by?: string | null
        }
      }
      department_leaders: {
        Row: {
          id: string
          department_id: string
          user_id: string
          assigned_at: string
          assigned_by: string | null
        }
        Insert: {
          id?: string
          department_id: string
          user_id: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Update: {
          id?: string
          department_id?: string
          user_id?: string
          assigned_at?: string
          assigned_by?: string | null
        }
      }
      machine_operators: {
        Row: {
          id: string
          machine_id: string
          user_id: string
          assigned_at: string
          assigned_by: string | null
        }
        Insert: {
          id?: string
          machine_id: string
          user_id: string
          assigned_at?: string
          assigned_by?: string | null
        }
        Update: {
          id?: string
          machine_id?: string
          user_id?: string
          assigned_at?: string
          assigned_by?: string | null
        }
      }
      machines: {
        Row: {
          id: string
          machine_code: string
          machine_name: string
          description: string
          current_status: string
          last_updated_at: string
          last_updated_by: string | null
          created_at: string
          department_id: string | null
        }
        Insert: {
          id?: string
          machine_code: string
          machine_name: string
          description?: string
          current_status?: string
          last_updated_at?: string
          last_updated_by?: string | null
          created_at?: string
          department_id?: string | null
        }
        Update: {
          id?: string
          machine_code?: string
          machine_name?: string
          description?: string
          current_status?: string
          last_updated_at?: string
          last_updated_by?: string | null
          created_at?: string
          department_id?: string | null
        }
      }
      status_types: {
        Row: {
          id: string
          name: string
          color: string
          is_default: boolean
          is_active: boolean
          display_order: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          color?: string
          is_default?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          color?: string
          is_default?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          created_by?: string | null
        }
      }
      status_history: {
        Row: {
          id: string
          machine_id: string
          status: string
          previous_status: string
          comment: string
          changed_by: string
          changed_at: string
        }
        Insert: {
          id?: string
          machine_id: string
          status: string
          previous_status?: string
          comment?: string
          changed_by: string
          changed_at?: string
        }
        Update: {
          id?: string
          machine_id?: string
          status?: string
          previous_status?: string
          comment?: string
          changed_by?: string
          changed_at?: string
        }
      }
    }
  }
}
