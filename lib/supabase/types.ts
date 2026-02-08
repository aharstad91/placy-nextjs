// Supabase Database Types
// Auto-generate with: npx supabase gen types typescript --project-id <your-project-id> > lib/supabase/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      collections: {
        Row: {
          id: string;
          slug: string;
          project_id: string;
          email: string | null;
          poi_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          project_id: string;
          email?: string | null;
          poi_ids: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          project_id?: string;
          email?: string | null;
          poi_ids?: string[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collections_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          icon: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          icon: string;
          color: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pois: {
        Row: {
          id: string;
          name: string;
          lat: number;
          lng: number;
          address: string | null;
          category_id: string | null;
          google_place_id: string | null;
          google_rating: number | null;
          google_review_count: number | null;
          google_maps_url: string | null;
          photo_reference: string | null;
          editorial_hook: string | null;
          local_insight: string | null;
          story_priority: "must_have" | "nice_to_have" | "filler" | null;
          editorial_sources: string[] | null;
          featured_image: string | null;
          description: string | null;
          entur_stopplace_id: string | null;
          bysykkel_station_id: string | null;
          hyre_station_id: string | null;
          trust_score: number | null;
          trust_flags: string[];
          trust_score_updated_at: string | null;
          google_website: string | null;
          google_business_status: string | null;
          google_price_level: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          lat: number;
          lng: number;
          address?: string | null;
          category_id?: string | null;
          google_place_id?: string | null;
          google_rating?: number | null;
          google_review_count?: number | null;
          google_maps_url?: string | null;
          photo_reference?: string | null;
          editorial_hook?: string | null;
          local_insight?: string | null;
          story_priority?: "must_have" | "nice_to_have" | "filler" | null;
          editorial_sources?: string[] | null;
          featured_image?: string | null;
          description?: string | null;
          entur_stopplace_id?: string | null;
          bysykkel_station_id?: string | null;
          hyre_station_id?: string | null;
          trust_score?: number | null;
          trust_flags?: string[];
          trust_score_updated_at?: string | null;
          google_website?: string | null;
          google_business_status?: string | null;
          google_price_level?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          lat?: number;
          lng?: number;
          address?: string | null;
          category_id?: string | null;
          google_place_id?: string | null;
          google_rating?: number | null;
          google_review_count?: number | null;
          google_maps_url?: string | null;
          photo_reference?: string | null;
          editorial_hook?: string | null;
          local_insight?: string | null;
          story_priority?: "must_have" | "nice_to_have" | "filler" | null;
          editorial_sources?: string[] | null;
          featured_image?: string | null;
          description?: string | null;
          entur_stopplace_id?: string | null;
          bysykkel_station_id?: string | null;
          hyre_station_id?: string | null;
          trust_score?: number | null;
          trust_flags?: string[];
          trust_score_updated_at?: string | null;
          google_website?: string | null;
          google_business_status?: string | null;
          google_price_level?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pois_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          customer_id: string | null;
          name: string;
          url_slug: string;
          center_lat: number;
          center_lng: number;
          product_type: string;
          venue_type: "hotel" | "residential" | "commercial";
          story_title: string | null;
          story_intro_text: string | null;
          story_hero_images: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          customer_id?: string | null;
          name: string;
          url_slug: string;
          center_lat: number;
          center_lng: number;
          product_type?: string;
          venue_type?: "hotel" | "residential" | "commercial";
          story_title?: string | null;
          story_intro_text?: string | null;
          story_hero_images?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          name?: string;
          url_slug?: string;
          center_lat?: number;
          center_lng?: number;
          product_type?: string;
          venue_type?: "hotel" | "residential" | "commercial";
          story_title?: string | null;
          story_intro_text?: string | null;
          story_hero_images?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      // NEW HIERARCHY TABLES (available after migration 006)
      products: {
        Row: {
          id: string;
          project_id: string;
          product_type: "explorer" | "report" | "guide";
          config: Record<string, unknown>;
          story_title: string | null;
          story_intro_text: string | null;
          story_hero_images: string[] | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          product_type: "explorer" | "report" | "guide";
          config?: Record<string, unknown>;
          story_title?: string | null;
          story_intro_text?: string | null;
          story_hero_images?: string[] | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          product_type?: "explorer" | "report" | "guide";
          config?: Record<string, unknown>;
          story_title?: string | null;
          story_intro_text?: string | null;
          story_hero_images?: string[] | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      product_pois: {
        Row: {
          product_id: string;
          poi_id: string;
          category_override_id: string | null;
          sort_order: number;
        };
        Insert: {
          product_id: string;
          poi_id: string;
          category_override_id?: string | null;
          sort_order?: number;
        };
        Update: {
          product_id?: string;
          poi_id?: string;
          category_override_id?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_pois_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_pois_poi_id_fkey";
            columns: ["poi_id"];
            referencedRelation: "pois";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_pois_category_override_id_fkey";
            columns: ["category_override_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      product_categories: {
        Row: {
          product_id: string;
          category_id: string;
          display_order: number;
        };
        Insert: {
          product_id: string;
          category_id: string;
          display_order?: number;
        };
        Update: {
          product_id?: string;
          category_id?: string;
          display_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_categories_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };
      project_pois: {
        Row: {
          project_id: string;
          poi_id: string;
          project_category_id: string | null;
        };
        Insert: {
          project_id: string;
          poi_id: string;
          project_category_id?: string | null;
        };
        Update: {
          project_id?: string;
          poi_id?: string;
          project_category_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_pois_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_pois_poi_id_fkey";
            columns: ["poi_id"];
            referencedRelation: "pois";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_pois_project_category_id_fkey";
            columns: ["project_category_id"];
            referencedRelation: "project_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      project_categories: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          icon: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          icon?: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          icon?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_categories_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      theme_stories: {
        Row: {
          id: string;
          project_id: string | null;
          slug: string;
          title: string;
          bridge_text: string | null;
          illustration: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          project_id?: string | null;
          slug: string;
          title: string;
          bridge_text?: string | null;
          illustration?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          slug?: string;
          title?: string;
          bridge_text?: string | null;
          illustration?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "theme_stories_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      story_sections: {
        Row: {
          id: string;
          project_id: string | null;
          type: string;
          sort_order: number;
          category_label: string | null;
          title: string | null;
          bridge_text: string | null;
          content: string | null;
          images: string[] | null;
          theme_story_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          project_id?: string | null;
          type: string;
          sort_order?: number;
          category_label?: string | null;
          title?: string | null;
          bridge_text?: string | null;
          content?: string | null;
          images?: string[] | null;
          theme_story_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          type?: string;
          sort_order?: number;
          category_label?: string | null;
          title?: string | null;
          bridge_text?: string | null;
          content?: string | null;
          images?: string[] | null;
          theme_story_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_sections_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "story_sections_theme_story_id_fkey";
            columns: ["theme_story_id"];
            referencedRelation: "theme_stories";
            referencedColumns: ["id"];
          }
        ];
      };
      section_pois: {
        Row: {
          section_id: string;
          poi_id: string;
          sort_order: number;
        };
        Insert: {
          section_id: string;
          poi_id: string;
          sort_order?: number;
        };
        Update: {
          section_id?: string;
          poi_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "section_pois_section_id_fkey";
            columns: ["section_id"];
            referencedRelation: "story_sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "section_pois_poi_id_fkey";
            columns: ["poi_id"];
            referencedRelation: "pois";
            referencedColumns: ["id"];
          }
        ];
      };
      theme_story_sections: {
        Row: {
          id: string;
          theme_story_id: string | null;
          title: string;
          description: string | null;
          images: string[] | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id: string;
          theme_story_id?: string | null;
          title: string;
          description?: string | null;
          images?: string[] | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          theme_story_id?: string | null;
          title?: string;
          description?: string | null;
          images?: string[] | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "theme_story_sections_theme_story_id_fkey";
            columns: ["theme_story_id"];
            referencedRelation: "theme_stories";
            referencedColumns: ["id"];
          }
        ];
      };
      theme_section_pois: {
        Row: {
          section_id: string;
          poi_id: string;
          sort_order: number;
        };
        Insert: {
          section_id: string;
          poi_id: string;
          sort_order?: number;
        };
        Update: {
          section_id?: string;
          poi_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "theme_section_pois_section_id_fkey";
            columns: ["section_id"];
            referencedRelation: "theme_story_sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "theme_section_pois_poi_id_fkey";
            columns: ["poi_id"];
            referencedRelation: "pois";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

// Helper types for easier access
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenience type aliases
export type DbCategory = Tables<"categories">;
export type DbPoi = Tables<"pois">;
export type DbCustomer = Tables<"customers">;
export type DbProject = Tables<"projects">;
export type DbProjectPoi = Tables<"project_pois">;
export type DbThemeStory = Tables<"theme_stories">;
export type DbStorySection = Tables<"story_sections">;
export type DbSectionPoi = Tables<"section_pois">;
export type DbThemeStorySection = Tables<"theme_story_sections">;
export type DbThemeSectionPoi = Tables<"theme_section_pois">;
export type DbCollection = Tables<"collections">;
export type DbProjectCategory = Tables<"project_categories">;
export type DbProduct = Tables<"products">;
export type DbProductPoi = Tables<"product_pois">;
export type DbProductCategory = Tables<"product_categories">;

// Product type enum
export type ProductType = "explorer" | "report" | "guide";

// Resolved POI type for frontend use (category resolution done)
export interface ResolvedPoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  photo_reference: string | null;
  editorial_hook: string | null;
  local_insight: string | null;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
  } | null;
  isProjectCategoryOverride: boolean;
}
