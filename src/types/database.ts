import type {
  OutreachStatus,
  VenueType,
  TemplateType,
  ExpenseCategory,
  DealTerms,
  TemplateSection,
} from './index'

export interface Database {
  public: {
    Tables: {
      venues: {
        Row: {
          id: string
          user_id: string
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
        Insert: {
          id?: string
          user_id: string
          name: string
          location?: string | null
          city?: string | null
          venue_type?: VenueType
          priority?: number
          status?: OutreachStatus
          follow_up_date?: string | null
          deal_terms?: DealTerms | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          location?: string | null
          city?: string | null
          venue_type?: VenueType
          priority?: number
          status?: OutreachStatus
          follow_up_date?: string | null
          deal_terms?: DealTerms | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          name: string
          role: string | null
          email: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          name: string
          role?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          name?: string
          role?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      outreach_notes: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          note?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'outreach_notes_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      templates: {
        Row: {
          id: string
          user_id: string
          name: string
          type: TemplateType
          sections: TemplateSection[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: TemplateType
          sections?: TemplateSection[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: TemplateType
          sections?: TemplateSection[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      generated_files: {
        Row: {
          id: string
          user_id: string
          name: string
          template_id: string | null
          venue_id: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          template_id?: string | null
          venue_id?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          template_id?: string | null
          venue_id?: string | null
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'generated_files_template_id_fkey'
            columns: ['template_id']
            referencedRelation: 'templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'generated_files_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          amount: number
          category: ExpenseCategory
          description: string | null
          date: string
          venue_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          category?: ExpenseCategory
          description?: string | null
          date?: string
          venue_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          category?: ExpenseCategory
          description?: string | null
          date?: string
          venue_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_venue_id_fkey'
            columns: ['venue_id']
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      outreach_status: OutreachStatus
      venue_type: VenueType
      template_type: TemplateType
      expense_category: ExpenseCategory
    }
    CompositeTypes: Record<string, never>
  }
}
