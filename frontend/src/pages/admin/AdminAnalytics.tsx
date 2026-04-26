import { useEffect, useState, useRef } from 'react'
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
  LineChart,
  Line,
} from 'recharts'
import { AlertCircle, Calendar, RefreshCw, Info, ChevronDown } from 'lucide-react'
import { AnalyticsOverviewResponse, analyticsApi } from '@/features/analytics/api/analyticsApi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const popupRef = useRef<HTMLDivElement>(null)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  // Filter states
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })

  const [tempStartDate, setTempStartDate] = useState<string>(customStartDate)
  const [tempEndDate, setTempEndDate] = useState<string>(customEndDate)
  const [level, setLevel] = useState<string>('')

  // reset temp UI when popup opens
  useEffect(() => {
    if (isDatePickerOpen) {
      setTempStartDate(customStartDate)
      setTempEndDate(customEndDate)
    }
  }, [isDatePickerOpen, customStartDate, customEndDate])

  // handle outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const applyQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setCustomStartDate(start.toISOString().split('T')[0])
    setCustomEndDate(end.toISOString().split('T')[0])
    setIsDatePickerOpen(false)
  }

  const applyCustomRange = () => {
    if (tempStartDate && tempEndDate && new Date(tempStartDate) <= new Date(tempEndDate)) {
      setCustomStartDate(tempStartDate)
      setCustomEndDate(tempEndDate)
      setIsDatePickerOpen(false)
    } else {
      setError('Thời gian tùy chỉnh không hợp lệ')
    }
  }

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  const loadData = async () => {
    try {
      if (!customStartDate || !customEndDate) return
      if (new Date(customStartDate) > new Date(customEndDate)) {
        setError('Ngày bắt đầu không được lớn hơn ngày kết thúc')
        return
      }

      setLoading(true)
      setError(null)

      const startDate = new Date(customStartDate)
      startDate.setHours(0, 0, 0, 0)
      const startDateStr = startDate.toISOString()

      const endDate = new Date(customEndDate)
      endDate.setHours(23, 59, 59, 999)
      const endDateStr = endDate.toISOString()

      const res = await analyticsApi.getOverview({
        start_date: startDateStr,
        end_date: endDateStr,
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
    if (customStartDate && customEndDate) {
      loadData()
    }
  }, [level, customStartDate, customEndDate])

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

        <div className="flex flex-wrap items-center gap-3 bg-card p-2 rounded-lg border border-border shadow-sm">
          <div className="relative" ref={popupRef}>
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-input hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{formatDateForDisplay(customStartDate)}</span>
              <span className="text-muted-foreground mx-1">-</span>
              <span>{formatDateForDisplay(customEndDate)}</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground ml-2 transition-transform duration-200 ${isDatePickerOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isDatePickerOpen && (
              <div className="absolute top-full right-0 sm:left-0 mt-2 p-4 bg-card rounded-xl border border-border shadow-xl z-50 w-[340px] flex flex-col gap-4 animate-in slide-in-from-top-2 origin-top">
                <div>
                  <p className="text-sm font-semibold mb-3">Thời gian nhanh</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => applyQuickRange(7)}
                    >
                      7 ngày
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => applyQuickRange(30)}
                    >
                      30 ngày
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => applyQuickRange(90)}
                    >
                      90 ngày
                    </Button>
                  </div>
                </div>

                <div className="w-full h-px bg-border my-1" />

                <div>
                  <p className="text-sm font-semibold mb-3">Tùy chỉnh khoảng thời gian</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-muted-foreground w-16">Từ ngày</label>
                      <input
                        type="date"
                        max={tempEndDate || new Date().toISOString().split('T')[0]}
                        value={tempStartDate}
                        onChange={(e) => setTempStartDate(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm rounded bg-slate-50 dark:bg-slate-800 border border-input focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-muted-foreground w-16">Đến ngày</label>
                      <input
                        type="date"
                        min={tempStartDate}
                        max={new Date().toISOString().split('T')[0]}
                        value={tempEndDate}
                        onChange={(e) => setTempEndDate(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm rounded bg-slate-50 dark:bg-slate-800 border border-input focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsDatePickerOpen(false)}>
                    Hủy
                  </Button>
                  <Button size="sm" onClick={applyCustomRange}>
                    Xác nhận
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
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
          <h3 className="text-4xl font-bold text-emerald-600 mt-2">
            {data.interaction_stats.total_takes}
          </h3>
        </Card>

        <Card className="p-6 flex flex-col justify-center relative overflow-hidden group">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Ước tính sai số AI</p>
            <div className="group/tooltip relative cursor-help">
              <Info className="w-4 h-4 text-muted-foreground/60 hover:text-primary transition-colors" />
              <div className="invisible group-hover/tooltip:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg z-50 text-center leading-relaxed">
                Chỉ số này được tính toán dựa trên mức độ tự tin của Model AI khi nhận diện âm
                thanh, do chưa có văn bản đối soát chuẩn. Chỉ số sẽ cập nhật dựa vào Feedback thực
                tế.
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
          <h3 className="text-4xl font-bold text-amber-500 mt-2">
            {(data.ai_quality_stats.confidence_error * 100).toFixed(1)}%
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Độ tin cậy tổng thể: {(data.ai_quality_stats.reliability_score * 100).toFixed(1)}%
          </p>
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
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
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
                    data={data.exam_stats.by_level.map((item, index) => ({
                      ...item,
                      fill: COLORS[index % COLORS.length],
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">Chưa có dữ liệu phân loại</p>
            )}
          </div>
        </Card>

        {/* AI Quality / Feedback distribution */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col h-12">
              <h3 className="text-lg font-semibold">Đánh giá hệ thống AI</h3>
              <span className="text-sm text-muted-foreground mt-1 invisible">Placeholder</span>
            </div>
            <span className="text-sm font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full whitespace-nowrap">
              Trung bình: {data.ai_quality_stats.average_rating} ⭐
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ai_quality_stats.rating_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                <Bar
                  dataKey="value"
                  name="Số lượt đánh giá AI"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* System Feedback distribution */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col h-12">
              <h3 className="text-lg font-semibold">Đánh giá chung (Trải nghiệm)</h3>
              <span className="text-sm text-muted-foreground mt-1">
                Tổng số: {data.system_quality_stats.total_feedbacks} lượt
              </span>
            </div>
            <span className="text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full whitespace-nowrap">
              Trung bình: {data.system_quality_stats.average_rating} ⭐
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.system_quality_stats.rating_distribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                <Bar
                  dataKey="value"
                  name="Số lượt đánh giá chung"
                  fill="#3b82f6"
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
