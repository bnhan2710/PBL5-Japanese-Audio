import { useState } from 'react'
import {
  Search,
  ChevronDown,
  RotateCcw,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  Headphones,
  MoreHorizontal,
} from 'lucide-react'

type Level = 'N1' | 'N2' | 'N3' | 'N4' | 'N5'
type Status = 'published' | 'draft' | 'needs_revision'

interface Question {
  id: string
  title: string
  level: Level
  topic: string
  createdAt: string
  status: Status
}

const MOCK_DATA: Question[] = [
  {
    id: 'Q-2025-8842',
    title: 'Sắp xếp lịch họp kinh doanh',
    level: 'N2',
    topic: 'Hiểu nhiệm vụ',
    createdAt: '24/10/2025',
    status: 'published',
  },
  {
    id: 'Q-2025-8845',
    title: 'Bài giảng giáo sư (Môi trường)',
    level: 'N1',
    topic: 'Hiểu điểm chính',
    createdAt: '23/10/2025',
    status: 'draft',
  },
  {
    id: 'Q-2025-8812',
    title: 'Nghe dự báo thời tiết mang dù',
    level: 'N3',
    topic: 'Diễn đạt lời nói',
    createdAt: '22/10/2025',
    status: 'published',
  },
  {
    id: 'Q-2025-8801',
    title: 'Thông báo nhà ga (Tàu trễ)',
    level: 'N4',
    topic: 'Phản xạ nhanh',
    createdAt: '20/10/2025',
    status: 'needs_revision',
  },
  {
    id: 'Q-2025-8799',
    title: 'Gọi món tại nhà hàng',
    level: 'N5',
    topic: 'Hiểu nhiệm vụ',
    createdAt: '19/10/2025',
    status: 'published',
  },
]

const LEVEL_COLORS: Record<Level, string> = {
  N1: 'bg-blue-600',
  N2: 'bg-teal-500',
  N3: 'bg-orange-400',
  N4: 'bg-orange-500',
  N5: 'bg-green-500',
}

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  published: {
    label: 'Đã xuất bản',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  draft: {
    label: 'Bản nháp',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  needs_revision: {
    label: 'Cần sửa đổi',
    className: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
}

export default function QuestionBankPage() {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const totalPages = 25
  const totalItems = 128

  const filtered = MOCK_DATA.filter((q) => {
    if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false
    if (levelFilter && q.level !== levelFilter) return false
    if (topicFilter && q.topic !== topicFilter) return false
    return true
  })

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((q) => q.id))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const resetFilters = () => {
    setSearch('')
    setLevelFilter('')
    setTopicFilter('')
    setDateFilter('')
    setCurrentPage(1)
  }

  const renderPageNumbers = () => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1, 2, 3)
      if (currentPage > 4) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Hệ thống quản lý, chỉnh sửa và xuất đề thi luyện nghe tiếng Nhật.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white hover:bg-slate-50 transition-colors">
            <Upload className="w-4 h-4" />
            Nhập dữ liệu
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
            <Plus className="w-4 h-4" />
            Tạo câu hỏi mới
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm (vd: Hiểu bài tập, ...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white placeholder:text-slate-400"
            />
          </div>

          {/* Level filter */}
          <div className="relative">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            >
              <option value="">Cấp độ</option>
              <option value="N1">N1</option>
              <option value="N2">N2</option>
              <option value="N3">N3</option>
              <option value="N4">N4</option>
              <option value="N5">N5</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Topic filter */}
          <div className="relative">
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            >
              <option value="">Chủ đề</option>
              <option value="Hiểu nhiệm vụ">Hiểu nhiệm vụ</option>
              <option value="Hiểu điểm chính">Hiểu điểm chính</option>
              <option value="Diễn đạt lời nói">Diễn đạt lời nói</option>
              <option value="Phản xạ nhanh">Phản xạ nhanh</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Date filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="py-2 px-3 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại bộ lọc
          </button>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase tracking-wide text-xs">
                Tiêu đề / ID
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase tracking-wide text-xs">
                Cấp độ
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase tracking-wide text-xs">
                Chủ đề
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase tracking-wide text-xs">
                Ngày tạo
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase tracking-wide text-xs">
                Trạng thái
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase tracking-wide text-xs">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50/70 transition-colors group">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(q.id)}
                    onChange={() => toggleOne(q.id)}
                    className="rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Headphones className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 leading-tight">{q.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">ID: {q.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-6 rounded text-white text-xs font-bold ${LEVEL_COLORS[q.level]}`}
                  >
                    {q.level}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-600">{q.topic}</td>
                <td className="px-4 py-4 text-slate-500">{q.createdAt}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[q.status].className}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {STATUS_CONFIG[q.status].label}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-500">
            Hiển thị{' '}
            <span className="font-medium">1</span> đến{' '}
            <span className="font-medium">5</span> trong tổng số{' '}
            <span className="font-medium">{totalItems}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {renderPageNumbers().map((page, idx) =>
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-sm">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`w-8 h-8 rounded-md text-sm font-medium transition-colors border ${
                    currentPage === page
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ),
            )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <StatCard
          icon={<StatsIcon emoji="☰" bg="bg-blue-50" color="text-blue-600" />}
          label="Tổng số câu hỏi"
          value="1,240"
        />
        <StatCard
          icon={<StatsIcon emoji="✓" bg="bg-emerald-50" color="text-emerald-600" />}
          label="Tạo trong tháng này"
          value="84"
        />
        <StatCard
          icon={<StatsIcon emoji="↗" bg="bg-orange-50" color="text-orange-500" />}
          label="Tỷ lệ chính xác TB"
          value="68%"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      {icon}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function StatsIcon({
  emoji,
  bg,
  color,
}: {
  emoji: string
  bg: string
  color: string
}) {
  return (
    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
      <span className={`text-base font-bold ${color}`}>{emoji}</span>
    </div>
  )
}
