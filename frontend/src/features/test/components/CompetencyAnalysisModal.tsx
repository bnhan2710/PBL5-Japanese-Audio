import { useEffect, useState } from 'react';
import {
  BrainCircuit,
  X,
  Target,
  Sparkles,
  Zap,
  ShieldCheck,
  Lightbulb,
  AlertTriangle,
  Loader2,
  Trophy,
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Button } from '@/components/ui/Button';
import { testClient } from '../api/testClient';
import { CompetencyAnalysisResponse } from '../types';

export interface CompetencyAnalysisModalProps {
  resultId: string;
  onClose: () => void;
}

export function CompetencyAnalysisModal({ resultId, onClose }: CompetencyAnalysisModalProps) {
  const [data, setData] = useState<CompetencyAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    testClient.getCompetencyAnalysis(resultId)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setError('');
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Không thể lấy dữ liệu phân tích. Vui lòng thử lại sau.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [resultId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dynamic blurred background layer */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
        onClick={onClose} 
      />

      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header Section with Gradient Background */}
        <div className="relative shrink-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 px-6 py-8 text-white sm:px-10">
          <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
            <svg width="400" height="200" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="300" cy="-50" r="150" fill="currentColor" />
              <circle cx="350" cy="150" r="100" fill="currentColor" />
            </svg>
          </div>
          
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-black/20 p-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/40 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-xl">
              <BrainCircuit className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Góc Chuyên Gia AI</h2>
              <p className="mt-1 text-sm font-medium text-white/80 opacity-90 sm:text-base">
                Phân tích sâu bằng tư duy đa chiều
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="min-h-[300px] flex-1 overflow-y-auto bg-muted/20 px-6 py-8 sm:px-10">
          {loading && (
            <div className="flex h-full flex-col items-center justify-center space-y-4 py-12">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 shadow-inner">
                <BrainCircuit className="absolute h-10 w-10 animate-pulse text-indigo-400 opacity-50" />
                <Loader2 className="h-20 w-20 animate-spin text-indigo-600" strokeWidth={1.5} />
              </div>
              <p className="animate-pulse text-lg font-bold tracking-tight text-indigo-900">
                AI đang suy luận chuỗi logic...
              </p>
              <p className="text-sm text-muted-foreground">Phân tích chuyên sâu sẽ hiển thị ngay</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Ups! Có lỗi xảy ra</h3>
              <p className="mt-2 max-w-md text-muted-foreground">{error}</p>
              <Button onClick={onClose} className="mt-6 rounded-full px-8">Đóng</Button>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              
              {/* Overview panel */}
              {data.overview && (
                <div className="relative overflow-hidden rounded-[24px] border border-indigo-100 dark:border-indigo-900/30 bg-card p-6 shadow-sm">
                  <div className="absolute -left-4 -top-4 rounded-full bg-indigo-50 p-6 opacity-50 blur-2xl"></div>
                  <div className="relative flex gap-4">
                    <div className="mt-1 shrink-0 text-indigo-500">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest text-indigo-400">Tổng quan năng lực</h4>
                      <p className="mt-2 text-[15px] leading-[1.8] text-card-foreground">
                        {data.overview}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Spider Chart / Radar Chart */}
              {data.skill_metrics && Object.keys(data.skill_metrics).length > 0 && (
                <div className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
                  <div className="mb-2 text-center">
                    <h4 className="text-xl font-black text-foreground">Bản đồ Năng lực Đồng bộ</h4>
                    <p className="text-sm text-muted-foreground">Đánh giá độ phủ kiến thức đa chiều</p>
                  </div>
                  <div className="mx-auto h-[350px] w-full max-w-lg">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart 
                          cx="50%" 
                          cy="50%" 
                          outerRadius="75%" 
                          data={Object.entries(data.skill_metrics)
                            .sort(([, a], [, b]) => (a.mondai_id || 99) - (b.mondai_id || 99))
                            .map(([subject, stats]) => {
                              const maxTotal = Math.max(...Object.values(data.skill_metrics).map(m => m.total));
                              // Each ring = 2 questions. 
                              // We use a decent minimum of 5 rings (10 pts) and a max based on content
                              const gridCount = Math.max(5, Math.ceil(maxTotal / 2));
                              return {
                                subject,
                                A: stats.correct,
                                percentage: stats.percentage,
                                correct: stats.correct,
                                total: stats.total,
                                fullMark: gridCount * 2,
                                gridCount,
                              };
                            })}
                        >
                          {/* Each ring represents 2 correct answers */}
                          <PolarGrid 
                            gridCount={Math.max(5, Math.ceil(Math.max(...Object.values(data.skill_metrics).map(m => m.total)) / 2))} 
                            stroke="var(--border)" 
                            strokeOpacity={0.5}
                          />
                          <PolarAngleAxis 
                            dataKey="subject" 
                            tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600 }} 
                          />
                          <PolarRadiusAxis 
                            domain={[0, (dataKey) => Math.max(10, Math.ceil(Math.max(...Object.values(data.skill_metrics).map(m => m.total)) / 2) * 2)]} 
                            tick={false} 
                            axisLine={false}
                            tickCount={Math.max(5, Math.ceil(Math.max(...Object.values(data.skill_metrics).map(m => m.total)) / 2)) + 1}
                          />
                          <RechartsTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="rounded-xl border border-border bg-card p-3 shadow-xl backdrop-blur-md">
                                    <p className="text-sm font-black text-foreground">{data.subject}</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <div className="h-2 w-full max-w-[60px] overflow-hidden rounded-full bg-muted">
                                        <div 
                                          className="h-full bg-indigo-500" 
                                          style={{ width: `${data.percentage}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold text-indigo-500">{data.percentage}%</span>
                                    </div>
                                    <p className="mt-1 text-[10px] text-muted-foreground font-medium italic">
                                      Làm đúng: <span className="text-foreground">{data.correct}/{data.total}</span> câu
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Radar
                            name="Kỹ năng"
                            dataKey="A"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fill="#818cf8"
                            fillOpacity={0.35}
                          />
                        </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                {/* Strengths */}
                {data.strengths && data.strengths.length > 0 && (
                  <div className="rounded-[24px] border border-border bg-card px-6 py-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <h4 className="text-lg font-black text-foreground">Điểm sáng nổi bật</h4>
                    </div>
                    <ul className="space-y-3">
                      {data.strengths.map((str, i) => (
                        <li key={i} className="flex gap-3 text-card-foreground">
                          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          <span className="text-sm leading-relaxed">{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Advice List */}
                {data.actionable_advice && data.actionable_advice.length > 0 && (
                  <div className="rounded-[24px] border border-border bg-card px-6 py-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <Target className="h-5 w-5" />
                      </div>
                      <h4 className="text-lg font-black text-foreground">Lộ trình bứt phá</h4>
                    </div>
                    <ul className="space-y-3">
                      {data.actionable_advice.map((adv, i) => (
                        <li key={i} className="flex gap-3 text-card-foreground">
                          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                          <span className="text-sm leading-relaxed">{adv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Deep Weakness Analysis */}
              {data.weaknesses_analysis && (
                <div className="rounded-[24px] border border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20 px-6 py-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <h4 className="text-lg font-black text-rose-900">Mổ xẻ lỗi tư duy</h4>
                  </div>
                  <p className="pl-1 text-[15px] leading-[1.8] text-rose-950/80">
                    {data.weaknesses_analysis}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="shrink-0 border-t border-border bg-card px-6 py-5 sm:px-10">
          <div className="flex justify-end">
            <Button
              className="rounded-full bg-primary text-primary-foreground px-8 py-6 font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              onClick={onClose}
            >
              Đã hiểu & Không ngừng cố gắng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
