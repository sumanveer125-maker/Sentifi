export type Emotion = 'happy' | 'sad' | 'stressed' | 'anxious' | 'neutral';

export type PersonalityType = 
  | 'The Saver' 
  | 'The Emotional Spender' 
  | 'The Risk Taker' 
  | 'The Social Spender' 
  | 'The Goal-Oriented Planner';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  notes?: string;
  date: string;
  emotion: Emotion;
  isImpulse: boolean;
}

export interface UserProfile {
  name: string;
  currency: string;
  monthlyBudget: number;
  studentBudget?: number;
  personality?: PersonalityType;
  healthScore: number;
  level: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  customCategories: string[];
  goalName?: string;
  goalAmount?: number;
}
