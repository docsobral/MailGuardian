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
      buckets: {
        Row: {
          created_at: string
          created_by: string | null
          html: Json
          id: number
          img: Json
          mjml: Json
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          html?: Json
          id?: number
          img?: Json
          mjml?: Json
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          html?: Json
          id?: number
          img?: Json
          mjml?: Json
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          admin: boolean | null
          id: string
        }
        Insert: {
          admin?: boolean | null
          id: string
        }
        Update: {
          admin?: boolean | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_timestamptz: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      install_available_extensions_and_test: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];