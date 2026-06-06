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
      orders: {
        Row: {
          created_at: string | null
          id: string
          package_id: string
          payment_method: string
          proof_image: string | null
          service_id: string
          status: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          package_id: string
          payment_method: string
          proof_image?: string | null
          service_id: string
          status?: string
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          package_id?: string
          payment_method?: string
          proof_image?: string | null
          service_id?: string
          status?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          cost_price: number | null
          created_at: string | null
          id: string
          name: string
          price: number
          service_id: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          id?: string
          name: string
          price: number
          service_id: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          message: string
          status: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          message: string
          status: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          message?: string
          status?: string
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
          updated_at: string | null
        }
        Insert: {
          key: string
          value?: string
          updated_at?: string | null
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_logs: {
        Row: {
          id: string
          order_id: string | null
          request: Json | null
          response: Json | null
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          request?: Json | null
          response?: Json | null
          status: string
          created_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string
          created_at?: string | null
        }
        Relationships: []
      }
      supplier_mappings: {
        Row: {
          id: string
          service_id: string
          package_id: string
          supplier_service_code: string
          supplier_package_code: string
          created_at: string | null
        }
        Insert: {
          id?: string
          service_id: string
          package_id: string
          supplier_service_code: string
          supplier_package_code: string
          created_at?: string | null
        }
        Update: {
          id?: string
          service_id?: string
          package_id?: string
          supplier_service_code?: string
          supplier_package_code?: string
          created_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          balance: number | null
          created_at: string | null
          email: string | null
          id: string
          role: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          email?: string | null
          id: string
          role?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      topup_requests: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_method: string
          proof_image: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_method: string
          proof_image?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_method?: string
          proof_image?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          direction: string
          id: string
          meta: Json | null
          method: string
          order_id: string | null
          payment_id: string | null
          reference: string | null
          status: string
          topup_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          direction?: string
          id?: string
          meta?: Json | null
          method: string
          order_id?: string | null
          payment_id?: string | null
          reference?: string | null
          status?: string
          topup_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          direction?: string
          id?: string
          meta?: Json | null
          method?: string
          order_id?: string | null
          payment_id?: string | null
          reference?: string | null
          status?: string
          topup_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      increment_balance: {
        Args: {
          user_id: string
          amount: number
        }
        Returns: undefined
      }
      approve_topup_request: {
        Args: {
          p_topup_id: string
        }
        Returns: Json
      }
      claim_order_for_supplier: {
        Args: {
          p_order_id: string
        }
        Returns: Json
      }
      reject_topup_request: {
        Args: {
          p_topup_id: string
        }
        Returns: Json
      }
      get_admin_analytics: {
        Args: {
          p_days: number
        }
        Returns: Json
      }
      bulk_update_order_status: {
        Args: {
          p_order_ids: string[]
          p_status: string
        }
        Returns: number
      }
      bulk_refund_orders: {
        Args: {
          p_order_ids: string[]
        }
        Returns: number
      }
      approve_deposit_request: {
        Args: {
          p_request_id: string
        }
        Returns: undefined
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
