
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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          color: string
          created_at: string | null
          icon: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string | null
          icon: string
          id: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          email: string | null
          id: string
          poi_ids: string[]
          project_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          poi_ids?: string[]
          project_id: string
          slug: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          poi_ids?: string[]
          project_id?: string
          slug?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      pois: {
        Row: {
          address: string | null
          bysykkel_station_id: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          editorial_hook: string | null
          editorial_sources: string[] | null
          entur_stopplace_id: string | null
          featured_image: string | null
          google_maps_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          hyre_station_id: string | null
          id: string
          lat: number
          lng: number
          local_insight: string | null
          name: string
          photo_reference: string | null
          story_priority: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bysykkel_station_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          editorial_hook?: string | null
          editorial_sources?: string[] | null
          entur_stopplace_id?: string | null
          featured_image?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          hyre_station_id?: string | null
          id: string
          lat: number
          lng: number
          local_insight?: string | null
          name: string
          photo_reference?: string | null
          story_priority?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bysykkel_station_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          editorial_hook?: string | null
          editorial_sources?: string[] | null
          entur_stopplace_id?: string | null
          featured_image?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          hyre_station_id?: string | null
          id?: string
          lat?: number
          lng?: number
          local_insight?: string | null
          name?: string
          photo_reference?: string | null
          story_priority?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pois_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          display_order: number | null
          product_id: string
        }
        Insert: {
          category_id: string
          display_order?: number | null
          product_id: string
        }
        Update: {
          category_id?: string
          display_order?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pois: {
        Row: {
          category_override_id: string | null
          poi_id: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          category_override_id?: string | null
          poi_id: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          category_override_id?: string | null
          poi_id?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pois_category_override_id_fkey"
            columns: ["category_override_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pois_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pois_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          config: Json
          created_at: string
          id: string
          product_type: string
          project_id: string
          story_hero_images: string[] | null
          story_intro_text: string | null
          story_title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          product_type: string
          project_id: string
          story_hero_images?: string[] | null
          story_intro_text?: string | null
          story_title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          product_type?: string
          project_id?: string
          story_hero_images?: string[] | null
          story_intro_text?: string | null
          story_title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pois: {
        Row: {
          poi_id: string
          project_id: string
          sort_order: number | null
        }
        Insert: {
          poi_id: string
          project_id: string
          sort_order?: number | null
        }
        Update: {
          poi_id?: string
          project_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_pois_poi_id_fkey1"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_pois_project_id_fkey1"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pois_legacy: {
        Row: {
          poi_id: string
          project_id: string
        }
        Insert: {
          poi_id: string
          project_id: string
        }
        Update: {
          poi_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pois_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_pois_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          customer_id: string
          description: string | null
          id: string
          name: string
          updated_at: string
          url_slug: string
          version: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          customer_id: string
          description?: string | null
          id: string
          name: string
          updated_at?: string
          url_slug: string
          version?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          url_slug?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey1"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      projects_legacy: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string | null
          customer_id: string | null
          generated_at: string | null
          id: string
          lens_config: Json | null
          lens_slug: string | null
          name: string
          parent_project_id: string | null
          product_type: string
          story_hero_images: string[] | null
          story_intro_text: string | null
          story_title: string | null
          updated_at: string | null
          url_slug: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string | null
          customer_id?: string | null
          generated_at?: string | null
          id: string
          lens_config?: Json | null
          lens_slug?: string | null
          name: string
          parent_project_id?: string | null
          product_type?: string
          story_hero_images?: string[] | null
          story_intro_text?: string | null
          story_title?: string | null
          updated_at?: string | null
          url_slug: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string | null
          customer_id?: string | null
          generated_at?: string | null
          id?: string
          lens_config?: Json | null
          lens_slug?: string | null
          name?: string
          parent_project_id?: string | null
          product_type?: string
          story_hero_images?: string[] | null
          story_intro_text?: string | null
          story_title?: string | null
          updated_at?: string | null
          url_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_parent"
            columns: ["parent_project_id"]
            isOneToOne: false
            referencedRelation: "projects_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      section_pois: {
        Row: {
          poi_id: string
          section_id: string
          sort_order: number
        }
        Insert: {
          poi_id: string
          section_id: string
          sort_order?: number
        }
        Update: {
          poi_id?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_pois_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_pois_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "story_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      story_sections: {
        Row: {
          bridge_text: string | null
          category_label: string | null
          content: string | null
          created_at: string | null
          id: string
          images: string[] | null
          project_id: string | null
          sort_order: number
          theme_story_id: string | null
          title: string | null
          type: string
        }
        Insert: {
          bridge_text?: string | null
          category_label?: string | null
          content?: string | null
          created_at?: string | null
          id: string
          images?: string[] | null
          project_id?: string | null
          sort_order?: number
          theme_story_id?: string | null
          title?: string | null
          type: string
        }
        Update: {
          bridge_text?: string | null
          category_label?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          images?: string[] | null
          project_id?: string | null
          sort_order?: number
          theme_story_id?: string | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_sections_theme_story_id_fkey"
            columns: ["theme_story_id"]
            isOneToOne: false
            referencedRelation: "theme_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_section_pois: {
        Row: {
          poi_id: string
          section_id: string
          sort_order: number
        }
        Insert: {
          poi_id: string
          section_id: string
          sort_order?: number
        }
        Update: {
          poi_id?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "theme_section_pois_poi_id_fkey"
            columns: ["poi_id"]
            isOneToOne: false
            referencedRelation: "pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theme_section_pois_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "theme_story_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_stories: {
        Row: {
          bridge_text: string | null
          created_at: string | null
          id: string
          illustration: string | null
          project_id: string | null
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          bridge_text?: string | null
          created_at?: string | null
          id: string
          illustration?: string | null
          project_id?: string | null
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          bridge_text?: string | null
          created_at?: string | null
          id?: string
          illustration?: string | null
          project_id?: string | null
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_stories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_story_sections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          sort_order: number
          theme_story_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          images?: string[] | null
          sort_order?: number
          theme_story_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          sort_order?: number
          theme_story_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_story_sections_theme_story_id_fkey"
            columns: ["theme_story_id"]
            isOneToOne: false
            referencedRelation: "theme_stories"
            referencedColumns: ["id"]
          },
        ]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
