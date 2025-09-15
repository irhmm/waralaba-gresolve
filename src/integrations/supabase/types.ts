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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_income: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string
          franchise_id: string
          id: string
          nominal: number
          tanggal: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by: string
          franchise_id: string
          id?: string
          nominal: number
          tanggal?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string
          franchise_id?: string
          id?: string
          nominal?: number
          tanggal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_income_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          created_at: string | null
          created_by: string
          franchise_id: string
          id: string
          keterangan: string | null
          nominal: number
          tanggal: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          franchise_id: string
          id?: string
          keterangan?: string | null
          nominal: number
          tanggal?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          franchise_id?: string
          id?: string
          keterangan?: string | null
          nominal?: number
          tanggal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          address: string | null
          created_at: string | null
          franchise_id: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      salary_withdrawals: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          franchise_id: string
          id: string
          tanggal: string | null
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          franchise_id: string
          id?: string
          tanggal?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          franchise_id?: string
          id?: string
          tanggal?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_withdrawals_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_withdrawals_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          franchise_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          franchise_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_income: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string
          fee: number
          franchise_id: string
          id: string
          jobdesk: string | null
          tanggal: string | null
          worker_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by: string
          fee: number
          franchise_id: string
          id?: string
          jobdesk?: string | null
          tanggal?: string | null
          worker_id: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string
          fee?: number
          franchise_id?: string
          id?: string
          jobdesk?: string | null
          tanggal?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_income_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_income_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string | null
          franchise_id: string
          id: string
          nama: string
          rekening: string | null
          role: string | null
          status: string | null
          wa: string | null
        }
        Insert: {
          created_at?: string | null
          franchise_id: string
          id?: string
          nama: string
          rekening?: string | null
          role?: string | null
          status?: string | null
          wa?: string | null
        }
        Update: {
          created_at?: string | null
          franchise_id?: string
          id?: string
          nama?: string
          rekening?: string | null
          role?: string | null
          status?: string | null
          wa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      worker_income_public: {
        Row: {
          code: string | null
          fee: number | null
          franchise_name: string | null
          franchise_slug: string | null
          id: string | null
          jobdesk: string | null
          tanggal: string | null
          worker_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_franchise_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_franchise_id: {
        Args: { target_user_id?: string }
        Returns: string
      }
      get_user_role: {
        Args: { target_user_id?: string }
        Returns: {
          franchise_id: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      is_super_admin: {
        Args: { target_user_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "franchise"
        | "admin_keuangan"
        | "admin_marketing"
        | "user"
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
    Enums: {
      app_role: [
        "super_admin",
        "franchise",
        "admin_keuangan",
        "admin_marketing",
        "user",
      ],
    },
  },
} as const
