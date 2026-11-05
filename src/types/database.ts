/**
 * Database definitions for Supabase client
 * Compatible with Supabase JS v2 GenericSchema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'ADMIN' | 'VIEWER';
export type TradeType = 'INTRADAY' | 'DELIVERY';
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED';
export type CalculationStatus = 'ESTIMATED' | 'RECONCILED';
export type ExchangeCode = 'NSE' | 'BSE';
export type AppliesToSide = 'BUY' | 'SELL' | 'BOTH';
export type CalculationBasis = 'TURNOVER_PCT' | 'FLAT_PER_EVENT' | 'FLAT_PER_CRORE' | 'ON_SERVICE_CHARGES';
export type MovementType = 'DEPOSIT' | 'WITHDRAWAL';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: UserRole;
          is_active: boolean;
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role: UserRole;
          is_active?: boolean;
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: UserRole;
          is_active?: boolean;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      persons: {
        Row: {
          id: string;
          household_id: string;
          display_name: string;
          relationship_label: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          display_name: string;
          relationship_label: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          display_name?: string;
          relationship_label?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      brokers: {
        Row: {
          id: string;
          code: 'KITE' | 'SHOONYA';
          name: string;
          website_url: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code: 'KITE' | 'SHOONYA';
          name: string;
          website_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          code?: 'KITE' | 'SHOONYA';
          name?: string;
          website_url?: string | null;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      broker_fee_rates: {
        Row: {
          id: string;
          broker_id: string;
          exchange: ExchangeCode | null;
          product_type: TradeType;
          charge_type: string;
          rate: number;
          max_per_order: number | null;
          applies_to_side: AppliesToSide;
          calculation_basis: CalculationBasis;
          security_group: string | null;
          effective_from: string;
          effective_to: string | null;
          source_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          broker_id: string;
          exchange?: ExchangeCode | null;
          product_type: TradeType;
          charge_type: string;
          rate: number;
          max_per_order?: number | null;
          applies_to_side: AppliesToSide;
          calculation_basis: CalculationBasis;
          security_group?: string | null;
          effective_from: string;
          effective_to?: string | null;
          source_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          broker_id?: string;
          exchange?: ExchangeCode | null;
          product_type?: TradeType;
          charge_type?: string;
          rate?: number;
          max_per_order?: number | null;
          applies_to_side?: AppliesToSide;
          calculation_basis?: CalculationBasis;
          security_group?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          source_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      trades: {
        Row: {
          id: string;
          household_id: string;
          portfolio_owner_id: string;
          broker_id: string;
          symbol: string;
          exchange: ExchangeCode;
          trade_type: TradeType;
          direction: TradeDirection;
          quantity: number;
          entry_price: number;
          exit_price: number | null;
          entry_at: string;
          exit_at: string | null;
          gross_pnl: number | null;
          total_charges: number;
          net_pnl: number | null;
          charges_breakdown: Json | null;
          calculation_status: CalculationStatus;
          status: TradeStatus;
          notes: string | null;
          created_by: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          initial_stop_loss: number | null;
          initial_risk_per_share: number | null;
          initial_risk_rupees: number | null;
          initial_risk_pct: number | null;
          planned_target: number | null;
          planned_rr: number | null;
          r1_price: number | null;
          r2_price: number | null;
          r3_price: number | null;
          strategy_name: string | null;
          current_stop_loss: number | null;
          max_adverse_excursion: number | null;
          max_favorable_excursion: number | null;
          realized_r_multiple: number | null;
          gross_r_multiple: number | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          portfolio_owner_id: string;
          broker_id: string;
          symbol: string;
          exchange?: ExchangeCode;
          trade_type: TradeType;
          direction: TradeDirection;
          quantity: number;
          entry_price: number;
          exit_price?: number | null;
          entry_at: string;
          exit_at?: string | null;
          gross_pnl?: number | null;
          total_charges?: number;
          net_pnl?: number | null;
          charges_breakdown?: Json | null;
          calculation_status?: CalculationStatus;
          status?: TradeStatus;
          notes?: string | null;
          created_by: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          initial_stop_loss?: number | null;
          initial_risk_per_share?: number | null;
          initial_risk_rupees?: number | null;
          initial_risk_pct?: number | null;
          planned_target?: number | null;
          planned_rr?: number | null;
          r1_price?: number | null;
          r2_price?: number | null;
          r3_price?: number | null;
          strategy_name?: string | null;
          current_stop_loss?: number | null;
          max_adverse_excursion?: number | null;
          max_favorable_excursion?: number | null;
          realized_r_multiple?: number | null;
          gross_r_multiple?: number | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          portfolio_owner_id?: string;
          broker_id?: string;
          symbol?: string;
          exchange?: ExchangeCode;
          trade_type?: TradeType;
          direction?: TradeDirection;
          quantity?: number;
          entry_price?: number;
          exit_price?: number | null;
          entry_at?: string;
          exit_at?: string | null;
          gross_pnl?: number | null;
          total_charges?: number;
          net_pnl?: number | null;
          charges_breakdown?: Json | null;
          calculation_status?: CalculationStatus;
          status?: TradeStatus;
          notes?: string | null;
          created_by?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          initial_stop_loss?: number | null;
          initial_risk_per_share?: number | null;
          initial_risk_rupees?: number | null;
          initial_risk_pct?: number | null;
          planned_target?: number | null;
          planned_rr?: number | null;
          r1_price?: number | null;
          r2_price?: number | null;
          r3_price?: number | null;
          strategy_name?: string | null;
          current_stop_loss?: number | null;
          max_adverse_excursion?: number | null;
          max_favorable_excursion?: number | null;
          realized_r_multiple?: number | null;
          gross_r_multiple?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      cash_movements: {
        Row: {
          id: string;
          household_id: string;
          portfolio_owner_id: string;
          movement_type: MovementType;
          amount: number;
          movement_date: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          portfolio_owner_id: string;
          movement_type: MovementType;
          amount: number;
          movement_date: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          portfolio_owner_id?: string;
          movement_type?: MovementType;
          amount?: number;
          movement_date?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      app_settings: {
        Row: {
          household_id: string;
          default_theme: ThemePreference;
          currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          household_id: string;
          default_theme?: ThemePreference;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          household_id?: string;
          default_theme?: ThemePreference;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trades_portfolio_owner_id_fkey';
            columns: ['portfolio_owner_id'];
            isOneToOne: false;
            referencedRelation: 'persons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trades_broker_id_fkey';
            columns: ['broker_id'];
            isOneToOne: false;
            referencedRelation: 'brokers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['id'];
            isOneToOne: false;
            referencedRelation: 'stop_loss_history';
            referencedColumns: ['trade_id'];
          }
        ];
      };
      stop_loss_history: {
        Row: {
          id: string;
          trade_id: string;
          previous_stop: number | null;
          new_stop: number;
          stop_type: 'INITIAL' | 'TRAIL' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'MANUAL';
          market_price_at_update: number | null;
          floating_r_at_update: number | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trade_id: string;
          previous_stop?: number | null;
          new_stop: number;
          stop_type?: 'INITIAL' | 'TRAIL' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'MANUAL';
          market_price_at_update?: number | null;
          floating_r_at_update?: number | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trade_id?: string;
          previous_stop?: number | null;
          new_stop?: number;
          stop_type?: 'INITIAL' | 'TRAIL' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'MANUAL';
          market_price_at_update?: number | null;
          floating_r_at_update?: number | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stop_loss_history_trade_id_fkey';
            columns: ['trade_id'];
            isOneToOne: false;
            referencedRelation: 'trades';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_my_household_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_my_portfolio_owner_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      trade_type: TradeType;
      trade_direction: TradeDirection;
      trade_status: TradeStatus;
      calculation_status: CalculationStatus;
      exchange_code: ExchangeCode;
      applies_to_side: AppliesToSide;
      calculation_basis: CalculationBasis;
      movement_type: MovementType;
      theme_preference: ThemePreference;
      stop_loss_update_type: 'INITIAL' | 'TRAIL' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'MANUAL';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
