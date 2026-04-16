import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'
import { AlertCircle, Calendar, RefreshCw, Info } from 'lucide-react'
import {
  AnalyticsOverviewResponse,
  analyticsApi,
} from '@/features/analytics/api/analyticsApi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [dateRange, setDateRange] = useState('30')
  const [level, setLevel] = useState<string>('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - parseInt(dateRange))

      const res = await analyticsApi.getOverview({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        level: level || undefined,
      })
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu thống kê, vui lòng thử lại sau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange, level])

  if (loading && !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex p-8 items-center justify-center">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
          <Button variant="outline" onClick={loadData} className="ml-4">
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Báo cáo Thống kê</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi toàn diện các chỉ số vận hành và chất lượng AI
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-2 rounded-lg border border-border">
          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-sm font-medium border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="7">7 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
            </select>
          </div>
          <div className="w-px h-6 bg-border mx-1" />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="bg-transparent text-sm font-medium border-none outline-none focus:ring-0 cursor-pointer pl-2"
          >
            <option value="">Tất cả cấp độ</option>
            <option value="N1">JLPT N1</option>
            <option value="N2">JLPT N2</option>
            <option value="N3">JLPT N3</option>
            <option value="N4">JLPT N4</option>
            <option value="N5">JLPT N5</option>
          </select>
          <Button variant="ghost" size="sm" onClick={loadData} title="Làm mới">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <Card className="p-6 flex flex-col justify-center">
          <p className="text-sm font-medium text-muted-foreground">Tổng số Đề thi</p>
          <h3 className="text-4xl font-bold text-primary mt-2">{data.exam_stats.total}</h3>
        </Card>
        
        <Card className="p-6 flex flex-col justify-center">
          <p className="text-sm font-medium text-muted-foreground">Lượt Tương tác (Làm bài)</p>
          <h3 className="text-4xl font-bold text-emerald-600 mt-2">{data.interaction_stats.total_takes}</h3>
        </Card>

        <Card className="p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Ước tính sai số AI</p>
            <div className="group/tooltip relative cursor-help">
              <Info className="w-4 h-4 text-muted-foreground/60 hover:text-primary transition-colors" />
              <div className="invisible group-hover/tooltip:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg z-50 text-center leading-relaxed">
                Chỉ số này được tính toán dựa trên mức độ tự tin của Model AI khi nhận diện âm thanh, do chưa có văn bản đối soát chuẩn. Chỉ số sẽ cập nhật dựa vào Feedback thực tế.
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
          <h3 className="text-4xl font-bold text-amber-500 mt-2">
            {(data.ai_quality_stats.confidence_error * 100).toFixed(1)}%
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Độ tin cậy tổng thể: {(data.ai_quality_stats.reliability_score * 100).toFixed(1)}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Thống kê mức độ làm bài */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Tần suất làm bài</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.interaction_stats.over_time}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={10} minTickGap={30} />
                <YAxis allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Lượt làm bài" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Phân loại cấp độ */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Phân loại phân bổ Đề thi</h3>
          <div className="h-72 w-full flex items-center justify-center">
            {data.exam_stats.by_level.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.exam_stats.by_level}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.exam_stats.by_level.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
                <p className="text-muted-foreground text-sm">Chưa có dữ liệu phân loại</p>
            )}
          </div>
        </Card>

        {/* AI Quality / Feedback distribution */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Đánh giá hệ thống AI từ người dùng</h3>
            <span className="text-sm font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
              Trung bình: {data.ai_quality_stats.average_rating} ⭐
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ai_quality_stats.rating_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ borderRadius: '8px' }}
                />
                <Bar 
                  dataKey="value" 
                  name="Số lượt đánh giá" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
