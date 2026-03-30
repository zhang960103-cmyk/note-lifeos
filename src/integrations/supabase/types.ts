export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          entry_id: string
          id: string
          role: string
          timestamp: string
          user_id: string
        }
        Insert: {
          content: string
          entry_id: string
          id?: string
          role: string
          timestamp?: string
          user_id: string
        }
        Update: {
          content?: string
          entry_id?: string
          id?: string
          role?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "day_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      day_entries: {
        Row: {
          date: string
          emotion_score: number
          emotion_tags: string[]
          id: string
          topic_tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          date: string
          emotion_score?: number
          emotion_tags?: string[]
          id?: string
          topic_tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          date?: string
          emotion_score?: number
          emotion_tags?: string[]
          id?: string
          topic_tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      energy_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          note: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          note?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          note?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          date: string
          id?: string
          note?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          check_ins: string[]
          created_at: string
          emoji: string
          id: string
          name: string
          target_days: number[]
          user_id: string
        }
        Insert: {
          check_ins?: string[]
          created_at?: string
          emoji?: string
          id?: string
          name: string
          target_days?: number[]
          user_id: string
        }
        Update: {
          check_ins?: string[]
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          target_days?: number[]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          onboarded: boolean
        }
        Insert: {
          created_at?: string
          id: string
          onboarded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          onboarded?: boolean
        }
        Relationships: []
      }
      todos: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          due_time: string | null
          emotion_tag: string | null
          entry_id: string | null
          id: string
          note: string | null
          priority: string
          recur: string
          recur_days: number[] | null
          reminder_minutes: number | null
          source_date: string | null
          status: string
          sub_tasks: Json
          tags: string[]
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          emotion_tag?: string | null
          entry_id?: string | null
          id?: string
          note?: string | null
          priority?: string
          recur?: string
          recur_days?: number[] | null
          reminder_minutes?: number | null
          source_date?: string | null
          status?: string
          sub_tasks?: Json
          tags?: string[]
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          emotion_tag?: string | null
          entry_id?: string | null
          id?: string
          note?: string | null
          priority?: string
          recur?: string
          recur_days?: number[] | null
          reminder_minutes?: number | null
          source_date?: string | null
          status?: string
          sub_tasks?: Json
          tags?: string[]
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "day_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      wheel_scores: {
        Row: {
          created_at: string
          date: string
          id: string
          scores: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          scores: Json
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          scores?: Json
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
