import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, TrendingUp, TrendingDown, Smile, Frown, Zap, AlertCircle, Target, 
  PieChart, History, Brain, ShieldCheck, ChevronRight, ChevronLeft, 
  Wallet, User, X, Trash2, Settings, Calendar 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { format, startOfWeek, endOfWeek, isWithinInterval, subDays, parseISO } from 'date-fns';
import { Expense, Emotion, UserProfile, BudgetGoal } from './types';
import { cn } from './lib/utils';
import { analyzePersonality, getMoodDoctorAdvice, getTriggerAnalysis, getSavingSuggestions } from './services/gemini';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-3xl p-6 shadow-sm border border-black/5", className)}>
    {children}
  </div>
);

const EmotionIcon = ({ emotion, size = 20 }: { emotion: Emotion; size?: number }) => {
  switch (emotion) {
    case 'happy': return <Smile size={size} className="text-emerald-500" />;
    case 'sad': return <Frown size={size} className="text-blue-500" />;
    case 'stressed': return <Zap size={size} className="text-orange-500" />;
    case 'anxious': return <AlertCircle size={size} className="text-purple-500" />;
    default: return <div className="w-5 h-5 rounded-full bg-slate-200" />;
  }
};

const HealthScore = ({ score, level }: { score: number; level: string }) => {
  const getColor = (s: number) => {
    if (s > 80) return 'text-emerald-500';
    if (s > 50) return 'text-orange-500';
    return 'text-rose-500';
  };

  return (
    <Card className="flex flex-col items-center justify-center space-y-2">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
          <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * score) / 100} className={cn("transition-all duration-1000", getColor(score))} />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold">{score}</span>
          <span className="text-[10px] uppercase tracking-widest opacity-50">Health</span>
        </div>
      </div>
      <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-600">
        {level} Rank
      </div>
    </Card>
  );
};

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('sentifi_expenses');
    return saved ? JSON.parse(saved) : [];
  });
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('sentifi_user');
    return saved ? JSON.parse(saved) : {
      name: "Guest", currency: "₹", monthlyBudget: 20000, healthScore: 78, level: 'Silver',
      customCategories: [], goalName: "New Laptop", goalAmount: 80000
    };
  });
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('sentifi_onboarded'));
  const [onboardingName, setOnboardingName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [tempBudget, setTempBudget] = useState(user.monthlyBudget.toString());
  const [tempGoalName, setTempGoalName] = useState(user.goalName || "New Laptop");
  const [tempGoalAmount, setTempGoalAmount] = useState(user.goalAmount?.toString() || "80000");
  
  const [doctorAdvice, setDoctorAdvice] = useState<string | null>(null);
  const [personality, setPersonality] = useState<{ type: string; insight: string; advice: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingTriggers, setIsAnalyzingTriggers] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [manualKey, setManualKey] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [triggerAnalysisText, setTriggerAnalysisText] = useState<string | null>(null);
  const [isStudentMode, setIsStudentMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  React.useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const completeOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardingName.trim()) {
      const updatedUser = { ...user, name: onboardingName.trim() };
      setUser(updatedUser);
      localStorage.setItem('sentifi_user', JSON.stringify(updatedUser));
      localStorage.setItem('sentifi_onboarded', 'true');
      setShowOnboarding(false);
    }
  };

  React.useEffect(() => { localStorage.setItem('sentifi_expenses', JSON.stringify(expenses)); }, [expenses]);
  React.useEffect(() => { localStorage.setItem('sentifi_user', JSON.stringify(user)); }, [user]);

  React.useEffect(() => {
    if (expenses.length >= 3 && !personality && !isAnalyzing) runAnalysis();
  }, [expenses.length]);

  const defaultCategories = ['Food & Mess', 'Transport', 'Shopping', 'Entertainment', 'Education & Books', 'Subscriptions', 'Miscellaneous'];
  const allCategories = useMemo(() => ['All', ...defaultCategories, ...user.customCategories], [user.customCategories]);

  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'amount') return b.amount - a.amount;
      if (sortBy === 'category') return a.category.localeCompare(b.category);
      return 0;
    });
    return sortOrder === 'desc' ? sorted : sorted.reverse();
  }, [expenses, sortBy, sortOrder]);

  const filteredExpenses = selectedCategory === 'All' ? sortedExpenses : sortedExpenses.filter(e => e.category === selectedCategory);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = (isStudentMode ? (user.studentBudget || 5000) : user.monthlyBudget) - totalSpent;

  const impulseInsights = useMemo(() => {
    const impulseBuys = expenses.filter(e => e.isImpulse);
    if (impulseBuys.length === 0) return null;
    const emotionCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    impulseBuys.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    });
    const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0][0];
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0];
    const impulseRatio = (impulseBuys.length / expenses.length) * 100;
    return { topEmotion, topCategory, impulseRatio: impulseRatio.toFixed(1) };
  }, [expenses]);

  const weeklyReport = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    const weekExpenses = expenses.filter(e => isWithinInterval(parseISO(e.date), { start, end }));
    const total = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = weekExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>);
    return { total, byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })) };
  }, [expenses]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTotal = expenses.filter(e => e.date.startsWith(dateStr)).reduce((sum, e) => sum + e.amount, 0);
      data.push({ name: format(date, 'EEE'), amount: dayTotal });
    }
    return data;
  }, [expenses]);

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newExpense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
      description: formData.get('description') as string,
      notes: formData.get('notes') as string,
      date: new Date().toISOString(),
      emotion: formData.get('emotion') as Emotion,
      isImpulse: formData.get('isImpulse') === 'on',
    };
    setExpenses([newExpense, ...expenses]);
    setShowAddModal(false);
    const advice = await getMoodDoctorAdvice(newExpense, isStudentMode ? 5000 : user.monthlyBudget, totalSpent + newExpense.amount);
    setDoctorAdvice(advice);
  };

  const handleDeleteExpense = () => {
    if (expenseToDelete) {
      setExpenses(expenses.filter(e => e.id !== expenseToDelete));
      setExpenseToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName && !user.customCategories.includes(newCategoryName)) {
      setUser({ ...user, customCategories: [...user.customCategories, newCategoryName] });
      setNewCategoryName('');
      setShowCategoryModal(false);
    }
  };

  const runTriggerAnalysis = async () => {
    setIsAnalyzingTriggers(true);
    try { const result = await getTriggerAnalysis(expenses); setTriggerAnalysisText(result); } finally { setIsAnalyzingTriggers(false); }
  };

  const handleUpdateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(tempBudget);
    if (!isNaN(amount) && amount > 0) {
      setUser({ ...user, [isStudentMode ? 'studentBudget' : 'monthlyBudget']: amount });
      setShowBudgetModal(false);
    }
  };

  const handleUpdateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(tempGoalAmount);
    if (tempGoalName.trim() && !isNaN(amount) && amount > 0) {
      setUser({ ...user, goalName: tempGoalName.trim(), goalAmount: amount });
      setShowGoalModal(false);
    }
  };

  React.useEffect(() => {
    const checkKey = async () => {
      const savedKey = localStorage.getItem('SENTIFI_GEMINI_KEY');
      const isPlaceholder = process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY" || process.env.GEMINI_API_KEY === "";
      if (savedKey) { setHasApiKey(true); return; }
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected || !isPlaceholder);
      } else { setHasApiKey(!isPlaceholder); }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      const selected = await window.aistudio.hasSelectedApiKey();
      if (selected) { setHasApiKey(true); if (expenses.length >= 3) runAnalysis(); }
    }
  };

  const handleManualKeySubmit = () => {
    if (manualKey.trim()) {
      localStorage.setItem('SENTIFI_GEMINI_KEY', manualKey.trim());
      setHasApiKey(true);
      if (expenses.length >= 3) runAnalysis();
    }
  };

  const runAnalysis = async () => {
    if (expenses.length === 0) return;
    setIsAnalyzing(true);
    try { const result = await analyzePersonality(expenses); setPersonality(result); } catch (err) { console.error(err); } finally { setIsAnalyzing(false); }
  };

  const loadDemoData = () => {
    const demoExpenses: Expense[] = [
      { id: '1', amount: 450, category: 'Food & Mess', description: 'Late night pizza', date: subDays(new Date(), 1).toISOString(), emotion: 'stressed', isImpulse: true },
      { id: '2', amount: 1200, category: 'Shopping', description: 'New sneakers', date: subDays(new Date(), 2).toISOString(), emotion: 'happy', isImpulse: true },
      { id: '3', amount: 200, category: 'Transport', description: 'Uber ride', date: subDays(new Date(), 3).toISOString(), emotion: 'anxious', isImpulse: false },
      { id: '4', amount: 800, category: 'Entertainment', description: 'Movie tickets', date: subDays(new Date(), 4).toISOString(), emotion: 'happy', isImpulse: false },
      { id: '5', amount: 1500, category: 'Food & Mess', description: 'Dinner with friends', date: subDays(new Date(), 5).toISOString(), emotion: 'happy', isImpulse: false },
    ];
    setExpenses(demoExpenses);
    setShowOnboarding(false);
  };
return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans pb-24">
      <header className="p-6 flex justify-between items-center max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sentifi</h1>
          <button onClick={() => setShowOnboarding(true)} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
            Mindful spending for {user.name} <Settings size={12} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {expenses.length === 0 && <button onClick={loadDemoData} className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 hover:text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-full transition-all">Try Demo</button>}
          {deferredPrompt && <button onClick={handleInstallClick} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition-all active:scale-95"><Plus size={14} /> Install App</button>}
          <button onClick={() => setIsStudentMode(!isStudentMode)} className={cn("px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all", isStudentMode ? "bg-indigo-600 text-white" : "bg-white border border-black/5 text-slate-500")}>{isStudentMode ? 'Student Mode' : 'Standard Mode'}</button>
          <button className="w-10 h-10 rounded-full bg-white border border-black/5 flex items-center justify-center shadow-sm"><Brain size={20} className="text-slate-600" /></button>
        </div>
      </header>

      {!isStandalone && !deferredPrompt && (
        <div className="max-w-2xl mx-auto px-6 mb-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Plus size={16} className="text-white" /></div>
              <p className="text-[10px] text-indigo-700 leading-tight"><span className="font-bold block">Install Sentifi on your phone!</span> Tap the browser menu and select "Install" or "Add to Home Screen" to use it like a real app.</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-900 text-white border-none">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-lg"><Wallet size={20} /></div>
              <button onClick={() => setShowCategoryModal(true)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"><Settings size={16} /></button>
            </div>
            <div className="cursor-pointer group" onClick={() => { setTempBudget((isStudentMode ? (user.studentBudget || 5000) : user.monthlyBudget).toString()); setShowBudgetModal(true); }}>
              <div className="text-2xl font-bold group-hover:text-indigo-300 transition-colors">{user.currency}{remainingBudget.toLocaleString()}</div>
              <div className="text-[10px] opacity-50 mt-1 flex items-center gap-1">Remaining of {user.currency}{(isStudentMode ? (user.studentBudget || 5000) : user.monthlyBudget).toLocaleString()} <Settings size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" /></div>
            </div>
          </Card>
          <HealthScore score={user.healthScore} level={user.level} />
        </div>

        <Card className="p-4">
          <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-indigo-600" /> Spending Trends</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs><linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} labelStyle={{ fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" fillOpacity={1} fill="url(#colorAmount)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2"><Calendar size={18} className="text-slate-600" /> Weekly Report</h3>
            <div className="text-xs font-bold text-slate-500">{format(startOfWeek(new Date()), 'MMM d')} - {format(endOfWeek(new Date()), 'MMM d')}</div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col justify-center">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Total Spent</div>
              <div className="text-2xl font-bold text-slate-900">{user.currency}{weeklyReport.total.toLocaleString()}</div>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyReport.byCategory}>
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {weeklyReport.byCategory.map((entry, index) => (<Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />))}
                  </Bar>
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '10px' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {impulseInsights && (
          <Card className="bg-rose-50 border-rose-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex items-center gap-2 text-rose-900"><Zap size={18} className="text-rose-500" /> Impulse Insights</h3>
              <button onClick={runTriggerAnalysis} disabled={isAnalyzingTriggers} className="text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50">{isAnalyzingTriggers ? 'Analyzing...' : 'Deep Analysis'}</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center"><div className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-1">Top Trigger</div><div className="flex items-center justify-center gap-1"><EmotionIcon emotion={impulseInsights.topEmotion as Emotion} size={16} /><span className="text-sm font-bold capitalize text-rose-900">{impulseInsights.topEmotion}</span></div></div>
              <div className="text-center border-x border-rose-200"><div className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-1">Top Category</div><div className="text-sm font-bold text-rose-900">{impulseInsights.topCategory}</div></div>
              <div className="text-center"><div className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-1">Impulse Ratio</div><div className="text-sm font-bold text-rose-900">{impulseInsights.impulseRatio}%</div></div>
            </div>
            {triggerAnalysisText && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-white/50 rounded-xl border border-rose-200 text-xs text-rose-800 leading-relaxed"><span className="font-bold uppercase tracking-widest block mb-1 opacity-50">Behavioral Analysis</span>{triggerAnalysisText}</motion.div>)}
          </Card>
        )}

        <AnimatePresence>
          {!hasApiKey && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-amber-50 border border-amber-200 rounded-3xl p-8 mb-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6"><Brain size={32} className="text-amber-600" /></div>
              <h3 className="text-xl font-bold text-amber-900 mb-2">Unlock AI Insights</h3>
              <p className="text-sm text-amber-700 mb-8 max-w-sm mx-auto">Connect your Gemini API key to see your spending personality and get personalized saving tips.</p>
              {!showManualEntry ? (
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <button onClick={handleSelectKey} className="w-full px-8 py-4 bg-amber-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95">Connect via AI Studio</button>
                  <button onClick={() => setShowManualEntry(true)} className="text-xs font-bold text-amber-600 hover:text-amber-700 uppercase tracking-widest py-2">Or enter key manually</button>
                </div>
              ) : (
                <div className="max-w-xs mx-auto">
                  <input type="password" placeholder="Paste your API key here..." value={manualKey} onChange={(e) => setManualKey(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-500 outline-none mb-3 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={handleManualKeySubmit} className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 transition-all">Save Key</button>
                    <button onClick={() => setShowManualEntry(false)} className="px-4 py-3 bg-white border border-amber-200 text-amber-600 rounded-xl font-bold text-xs">Back</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {doctorAdvice && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 relative">
              <button onClick={() => setDoctorAdvice(null)} className="absolute top-4 right-4 text-indigo-400 hover:text-indigo-600"><X size={16} /></button>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"><Brain size={20} className="text-white" /></div>
                <div><h4 className="text-sm font-bold text-indigo-900">Financial Mood Doctor</h4><p className="text-sm text-indigo-700 mt-1 leading-relaxed">{doctorAdvice}</p></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-600" /> Spending Personality</h3>
            <button onClick={runAnalysis} disabled={isAnalyzing || expenses.length === 0} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50">{isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}</button>
          </div>
          {personality ? (
            <div className="space-y-2">
              <div className="text-lg font-bold text-emerald-900">{personality.type}</div>
              <p className="text-sm text-emerald-700 italic">"{personality.insight}"</p>
              <div className="mt-3 p-3 bg-white/50 rounded-xl border border-emerald-200 text-xs text-emerald-800"><span className="font-bold uppercase tracking-widest block mb-1 opacity-50">Advice</span>{personality.advice}</div>
            </div>
          ) : (<p className="text-sm text-emerald-700 opacity-60">Log at least 3 expenses to unlock your AI personality profile.</p>)}
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold flex items-center gap-2"><TrendingUp size={18} className="text-slate-600" /> Future Visualization</h3>
            <button onClick={() => { setTempGoalName(user.goalName || "New Laptop"); setTempGoalAmount(user.goalAmount?.toString() || "80000"); setShowGoalModal(true); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors"><Settings size={16} /></button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm"><Target size={20} className="text-blue-500" /></div>
                <div><div className="text-sm font-bold">{user.goalName || "New Laptop"}</div><div className="text-[10px] text-slate-500">Goal: {user.currency}{user.goalAmount?.toLocaleString() || "80,000"}</div></div>
              </div>
              <div className="text-right"><div className="text-sm font-bold text-emerald-600">{Math.ceil((user.goalAmount || 80000) / Math.max(1, (isStudentMode ? (user.studentBudget || 5000) : user.monthlyBudget) - totalSpent))} Months</div><div className="text-[10px] text-slate-500">at current pace</div></div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><History size={18} className="text-slate-600" /> Recent Activity</h3>
            <div className="flex items-center gap-2">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="text-[10px] font-bold uppercase tracking-widest bg-white border border-black/5 rounded-lg px-2 py-1 outline-none"><option value="date">Date</option><option value="amount">Amount</option><option value="category">Category</option></select>
              <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-1 bg-white border border-black/5 rounded-lg text-slate-500">{sortOrder === 'desc' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}</button>
            </div>
          </div>
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <motion.div key={expense.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-black/5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center"><EmotionIcon emotion={expense.emotion} /></div>
                  <div><div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{expense.category}</span>{expense.isImpulse && (<span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">Impulse</span>)}</div><div className="text-sm font-bold">{expense.description}</div></div>
                </div>
                <div className="text-right flex items-center gap-4"><div><div className="text-sm font-bold">-{user.currency}{expense.amount}</div><div className="text-[10px] text-slate-400">{new Date(expense.date).toLocaleDateString()}</div></div><button onClick={() => { setExpenseToDelete(expense.id); setShowDeleteModal(true); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <button onClick={() => setShowAddModal(true)} className="fixed bottom-8 right-8 w-14 h-14 bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95"><Plus size={24} /></button>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-6"><button onClick={() => setShowAddModal(false)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-400"><ChevronLeft size={24} /></button><h2 className="text-xl font-bold">Log Expense</h2></div>
              <form onSubmit={handleAddExpense} className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Amount</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">{user.currency}</span><input name="amount" type="number" required className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold" placeholder="0.00" /></div></div>
                <div className="space-y-2"><label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Description</label><input name="description" type="text" required className="w-full bg-slate-50 border-none rounded-2xl py-4 px-4" placeholder="What did you buy?" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Category</label><select name="category" className="w-full bg-slate-50 border-none rounded-2xl py-4 px-4 appearance-none">{allCategories.filter(c => c !== 'All').map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                  <div className="space-y-2"><label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Emotion</label><select name="emotion" className="w-full bg-slate-50 border-none rounded-2xl py-4 px-4 appearance-none"><option value="happy">Happy 😃</option><option value="neutral">Neutral 😐</option><option value="sad">Sad 😞</option><option value="stressed">Stressed 😫</option><option value="anxious">Anxious 😰</option></select></div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl"><input type="checkbox" name="isImpulse" id="isImpulse" className="w-5 h-5 rounded border-slate-300" /><label htmlFor="isImpulse" className="text-sm font-medium">Was this an impulse buy?</label></div>
                <div className="flex gap-3"><button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg">Log Expense</button></div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div>
              <h2 className="text-xl font-bold mb-2">Delete Expense?</h2><p className="text-slate-500 text-sm mb-8">This action cannot be undone.</p>
              <div className="flex gap-3"><button onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100">Cancel</button><button onClick={handleDeleteExpense} className="flex-1 py-4 rounded-2xl font-bold text-white bg-rose-500">Delete</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9 }} className="relative bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3"><Brain size={40} /></div>
              <h2 className="text-3xl font-bold mb-3 tracking-tight">Welcome to Sentifi</h2><p className="text-slate-500 text-sm mb-10">Track the psychology behind your spending.</p>
              <form onSubmit={completeOnboarding} className="space-y-6"><input type="text" value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-5 px-6 text-lg font-bold" placeholder="Enter your name..." required /><button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-lg">Get Started</button></form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
