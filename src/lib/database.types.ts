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
      businesses: {
        Row: {
          id: string
          name: string
          status: 'active' | 'inactive'
          created_at: string
          owner_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          status?: 'active' | 'inactive'
          created_at?: string
          owner_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          status?: 'active' | 'inactive'
          created_at?: string
          owner_id?: string
          settings?: Json
          updated_at?: string
        }
      }
      business_staff: {
        Row: {
          id: string
          user_id: string
          business_id: string
          role: 'admin' | 'staff'
          status: 'active' | 'inactive'
          permissions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_id: string
          role?: 'admin' | 'staff'
          status?: 'active' | 'inactive'
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_id?: string
          role?: 'admin' | 'staff'
          status?: 'active' | 'inactive'
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          customer_id: string
          total_amount: number
          currency: string
          status: 'draft' | 'sent' | 'accepted' | 'rejected'
          valid_until: string
          created_at: string
          business_id: string
        }
        Insert: {
          id?: string
          customer_id: string
          total_amount: number
          currency: string
          status?: 'draft' | 'sent' | 'accepted' | 'rejected'
          valid_until: string
          created_at?: string
          business_id: string
        }
        Update: {
          id?: string
          customer_id?: string
          total_amount?: number
          currency?: string
          status?: 'draft' | 'sent' | 'accepted' | 'rejected'
          valid_until?: string
          created_at?: string
          business_id?: string
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_name: string
          quantity: number
          price_at_time: number
          currency: string
          created_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          product_name: string
          quantity: number
          price_at_time: number
          currency: string
          created_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          product_name?: string
          quantity?: number
          price_at_time?: number
          currency?: string
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          business_id: string
          name: string
          sku: string | null
          price: number
          currency: string
          stock: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          sku?: string | null
          price: number
          currency: string
          stock?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          sku?: string | null
          price?: number
          currency?: string
          stock?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      business_staff_with_users: {
        Row: {
          id: string
          user_id: string
          business_id: string
          role: 'admin' | 'staff'
          status: 'active' | 'inactive'
          permissions: Json
          created_at: string
          updated_at: string
          email: string
          user_created_at: string
        }
      }
    }
    Functions: {
      check_business_access: {
        Args: {
          business_id: string
          required_role?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      business_status: 'active' | 'inactive'
      staff_role: 'admin' | 'staff'
      staff_status: 'active' | 'inactive'
    }
  }
}
