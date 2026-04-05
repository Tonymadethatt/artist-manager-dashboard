import type { OutreachStatus, VenueType, TemplateType, ExpenseCategory, DealTerms, TemplateSection } from './index'

export interface Database {
  public: {
    Tables: {
      venues: {
        Row: {
          id: string
          name: string
          location: string | null
          city: string | null
          venue_type: VenueType
          priority: number
          status: OutreachStatus
          follow_up_date: string | null
          deal_terms: DealTerms | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['venues']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['venues']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          venue_id: string
          name: string
          role: string | null
          email: string | null
          phone: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      outreach_notes: {
        Row: {
          id: string
          venue_id: string
          note: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['outreach_notes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['outreach_notes']['Insert']>
      }
      templates: {
        Row: {
          id: string
          name: string
          type: TemplateType
          sections: TemplateSection[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['templates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['templates']['Insert']>
      }
      generated_files: {
        Row: {
          id: string
          name: string
          template_id: string | null
          venue_id: string | null
          content: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['generated_files']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['generated_files']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          amount: number
          category: ExpenseCategory
          description: string | null
          date: string
          venue_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
    }
  }
}
