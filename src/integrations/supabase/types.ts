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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agg_codes: {
        Row: {
          codigos: string
          id: string
          item: string
          user_id: string
        }
        Insert: {
          codigos?: string
          id?: string
          item: string
          user_id?: string
        }
        Update: {
          codigos?: string
          id?: string
          item?: string
          user_id?: string
        }
        Relationships: []
      }
      agg_goals: {
        Row: {
          consultant_id: string
          id: string
          item: string
          mes: string
          meta_qtd: number
          meta_valor: number
          user_id: string
        }
        Insert: {
          consultant_id: string
          id?: string
          item: string
          mes: string
          meta_qtd?: number
          meta_valor?: number
          user_id?: string
        }
        Update: {
          consultant_id?: string
          id?: string
          item?: string
          mes?: string
          meta_qtd?: number
          meta_valor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agg_goals_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      agg_sales: {
        Row: {
          consultant_id: string
          dia: string
          id: string
          item: string
          qtd: number
          user_id: string
          valor: number
        }
        Insert: {
          consultant_id: string
          dia: string
          id?: string
          item: string
          qtd?: number
          user_id?: string
          valor?: number
        }
        Update: {
          consultant_id?: string
          dia?: string
          id?: string
          item?: string
          qtd?: number
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "agg_sales_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      agg_visits: {
        Row: {
          consultant_id: string
          dia: string
          id: string
          passagens: number
          user_id: string
        }
        Insert: {
          consultant_id: string
          dia: string
          id?: string
          passagens?: number
          user_id?: string
        }
        Update: {
          consultant_id?: string
          dia?: string
          id?: string
          passagens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agg_visits_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          nome: string
          telefone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          nome: string
          telefone?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          nome?: string
          telefone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultants_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales: {
        Row: {
          consultant_id: string
          dia: string
          id: string
          pecas: number
          servicos: number
          user_id: string
        }
        Insert: {
          consultant_id: string
          dia: string
          id?: string
          pecas?: number
          servicos?: number
          user_id?: string
        }
        Update: {
          consultant_id?: string
          dia?: string
          id?: string
          pecas?: number
          servicos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          consultant_id: string
          id: string
          mes: string
          pecas: number
          servicos: number
          user_id: string
        }
        Insert: {
          consultant_id: string
          id?: string
          mes: string
          pecas?: number
          servicos?: number
          user_id?: string
        }
        Update: {
          consultant_id?: string
          id?: string
          mes?: string
          pecas?: number
          servicos?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      month_params: {
        Row: {
          base: string
          dc_decorridos: number
          dc_totais: number
          du_decorridos: number
          du_totais: number
          id: string
          mes: string
          user_id: string
        }
        Insert: {
          base?: string
          dc_decorridos?: number
          dc_totais?: number
          du_decorridos?: number
          du_totais?: number
          id?: string
          mes: string
          user_id?: string
        }
        Update: {
          base?: string
          dc_decorridos?: number
          dc_totais?: number
          du_decorridos?: number
          du_totais?: number
          id?: string
          mes?: string
          user_id?: string
        }
        Relationships: []
      }
      open_order_snapshots: {
        Row: {
          id: string
          mes: string
          updated_at: string
          user_id: string
          valores: Json
        }
        Insert: {
          id?: string
          mes: string
          updated_at?: string
          user_id?: string
          valores?: Json
        }
        Update: {
          id?: string
          mes?: string
          updated_at?: string
          user_id?: string
          valores?: Json
        }
        Relationships: []
      }
      os_imports: {
        Row: {
          arquivo: string
          at: string
          id: string
          itens: Json
          nome: string
          user_id: string
        }
        Insert: {
          arquivo?: string
          at?: string
          id?: string
          itens?: Json
          nome?: string
          user_id?: string
        }
        Update: {
          arquivo?: string
          at?: string
          id?: string
          itens?: Json
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          owner_id: string
          papel: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          owner_id?: string
          papel?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          owner_id?: string
          papel?: string
        }
        Relationships: []
      }
      update_log: {
        Row: {
          at: string
          id: string
          nome: string
          origem: string
          user_id: string
        }
        Insert: {
          at?: string
          id?: string
          nome: string
          origem: string
          user_id?: string
        }
        Update: {
          at?: string
          id?: string
          nome?: string
          origem?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: { Args: never; Returns: boolean }
      data_owner: { Args: never; Returns: string }
      import_sales_period: {
        Args: { p_fim: string; p_ini: string; p_rows: Json }
        Returns: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
