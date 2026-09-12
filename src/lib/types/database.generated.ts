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
      anamnesis: {
        Row: {
          alergias: string | null
          atividade_fisica: string | null
          created_at: string
          habitos_alimentares: string | null
          historico_familiar: string | null
          historico_saude: string | null
          id: string
          intolerancias: string | null
          medicamentos: string | null
          observacoes: string | null
          patient_id: string
          qualidade_sono: string | null
          queixa_principal: string | null
          suplementos: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alergias?: string | null
          atividade_fisica?: string | null
          created_at?: string
          habitos_alimentares?: string | null
          historico_familiar?: string | null
          historico_saude?: string | null
          id?: string
          intolerancias?: string | null
          medicamentos?: string | null
          observacoes?: string | null
          patient_id: string
          qualidade_sono?: string | null
          queixa_principal?: string | null
          suplementos?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alergias?: string | null
          atividade_fisica?: string | null
          created_at?: string
          habitos_alimentares?: string | null
          historico_familiar?: string | null
          historico_saude?: string | null
          id?: string
          intolerancias?: string | null
          medicamentos?: string | null
          observacoes?: string | null
          patient_id?: string
          qualidade_sono?: string | null
          queixa_principal?: string | null
          suplementos?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      anthropometric_assessments: {
        Row: {
          altura_cm: number
          circunferencia_braco_cm: number | null
          circunferencia_cintura_cm: number | null
          circunferencia_coxa_cm: number | null
          circunferencia_pescoco_cm: number | null
          circunferencia_quadril_cm: number | null
          created_at: string
          data_avaliacao: string
          id: string
          imc: number | null
          observacoes: string | null
          patient_id: string
          percentual_gordura: number | null
          peso_kg: number
          user_id: string
        }
        Insert: {
          altura_cm: number
          circunferencia_braco_cm?: number | null
          circunferencia_cintura_cm?: number | null
          circunferencia_coxa_cm?: number | null
          circunferencia_pescoco_cm?: number | null
          circunferencia_quadril_cm?: number | null
          created_at?: string
          data_avaliacao?: string
          id?: string
          imc?: number | null
          observacoes?: string | null
          patient_id: string
          percentual_gordura?: number | null
          peso_kg: number
          user_id: string
        }
        Update: {
          altura_cm?: number
          circunferencia_braco_cm?: number | null
          circunferencia_cintura_cm?: number | null
          circunferencia_coxa_cm?: number | null
          circunferencia_pescoco_cm?: number | null
          circunferencia_quadril_cm?: number | null
          created_at?: string
          data_avaliacao?: string
          id?: string
          imc?: number | null
          observacoes?: string | null
          patient_id?: string
          percentual_gordura?: number | null
          peso_kg?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anthropometric_assessments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          calorias_kcal: number
          carboidratos_g: number
          categoria: string
          created_at: string
          fibras_g: number
          gorduras_g: number
          id: string
          marca: string | null
          nome: string
          porcao_referencia_g: number
          proteinas_g: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calorias_kcal?: number
          carboidratos_g?: number
          categoria: string
          created_at?: string
          fibras_g?: number
          gorduras_g?: number
          id?: string
          marca?: string | null
          nome: string
          porcao_referencia_g?: number
          proteinas_g?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calorias_kcal?: number
          carboidratos_g?: number
          categoria?: string
          created_at?: string
          fibras_g?: number
          gorduras_g?: number
          id?: string
          marca?: string | null
          nome?: string
          porcao_referencia_g?: number
          proteinas_g?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          created_at: string
          food_id: string
          id: string
          meal_id: string
          ordem: number
          quantidade_g: number
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          meal_id: string
          ordem?: number
          quantidade_g: number
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          meal_id?: string
          ordem?: number
          quantidade_g?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          ativo: boolean
          created_at: string
          data_inicio: string
          id: string
          nome: string
          observacoes: string | null
          patient_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_inicio?: string
          id?: string
          nome?: string
          observacoes?: string | null
          patient_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_inicio?: string
          id?: string
          nome?: string
          observacoes?: string | null
          patient_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          horario: string | null
          id: string
          meal_plan_id: string
          nome: string
          ordem: number
          user_id: string
        }
        Insert: {
          created_at?: string
          horario?: string | null
          id?: string
          meal_plan_id: string
          nome: string
          ordem?: number
          user_id: string
        }
        Update: {
          created_at?: string
          horario?: string | null
          id?: string
          meal_plan_id?: string
          nome?: string
          ordem?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          ativo: boolean
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          objetivo: string | null
          observacoes: string | null
          sexo: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          crn: string | null
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crn?: string | null
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crn?: string | null
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
