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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          company_id: string
          created_at: string
          current_balance: number
          id: string
          name: string
          opening_balance: number
          status: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          company_id: string
          created_at?: string
          current_balance?: number
          id?: string
          name: string
          opening_balance?: number
          status?: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          company_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          name?: string
          opening_balance?: number
          status?: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          month: string
          monthly_limit: number
        }
        Insert: {
          category_id: string
          company_id: string
          created_at?: string
          id?: string
          month: string
          monthly_limit: number
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          month?: string
          monthly_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          group: Database["public"]["Enums"]["category_group"]
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          group: Database["public"]["Enums"]["category_group"]
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          group?: Database["public"]["Enums"]["category_group"]
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          company_type: Database["public"]["Enums"]["company_type"]
          created_at: string
          created_by: string | null
          currency: string
          email: string | null
          gst_vat: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["company_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          gst_vat?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string | null
          gst_vat?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          current_amount: number
          deadline: string | null
          goal_type: string
          id: string
          name: string
          status: string
          target_amount: number
        }
        Insert: {
          company_id: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          goal_type?: string
          id?: string
          name: string
          status?: string
          target_amount: number
        }
        Update: {
          company_id?: string
          created_at?: string
          current_amount?: number
          deadline?: string | null
          goal_type?: string
          id?: string
          name?: string
          status?: string
          target_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          must_reset_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          must_reset_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_reset_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      super_admin_sessions: {
        Row: {
          company_id: string
          ended_at: string | null
          id: string
          started_at: string
          super_admin_id: string
        }
        Insert: {
          company_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          super_admin_id: string
        }
        Update: {
          company_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          super_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          attachment_url: string | null
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          occurred_on: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          to_account_id: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
          vendor: string | null
        }
        Insert: {
          account_id: string
          amount: number
          attachment_url?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_on?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          to_account_id?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
          vendor?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_on?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_super_admin: { Args: { _email: string }; Returns: string }
      effective_company_id: { Args: { _user: string }; Returns: string }
      has_company_role: {
        Args: {
          _company: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: boolean
      }
      is_company_admin: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      is_company_manager_or_admin: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      account_type: "cash" | "bank" | "wallet" | "upi" | "credit_card"
      app_role: "super_admin" | "company_admin" | "manager" | "employee"
      category_group: "income" | "expense"
      company_status: "active" | "suspended"
      company_type: "personal" | "commercial"
      payment_method: "cash" | "upi" | "card" | "bank" | "other"
      txn_type: "income" | "expense" | "transfer"
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
      account_type: ["cash", "bank", "wallet", "upi", "credit_card"],
      app_role: ["super_admin", "company_admin", "manager", "employee"],
      category_group: ["income", "expense"],
      company_status: ["active", "suspended"],
      company_type: ["personal", "commercial"],
      payment_method: ["cash", "upi", "card", "bank", "other"],
      txn_type: ["income", "expense", "transfer"],
    },
  },
} as const
