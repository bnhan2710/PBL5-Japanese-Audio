import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, Loader2, CheckCircle2, ChevronLeft, Calendar, Eye } from 'lucide-react'
import { resultClient, UserResultListResponse } from './api/resultClient'

export function ExamHistoryPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<UserResultListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadResults(1)
  }, [])

  const loadResults = async (targetPage: number) => {
    try {
      setLoading(true)
      const res = await resultClient.getMyResults(targetPage, 12)
      setData(res)
      setPage(targetPage)
    } catch (error) {
      console.error('Failed to load exam history:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevPage = () => {
    if (page > 1) {
      loadResults(page - 1)
    }
  }

  const handleNextPage = () => {
    if (data && page < data.total_pages) {
      loadResults(page + 1)
    }
  }

  return (
    <div className="min-h-screen bg-muted pb-12">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 -ml-2 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-full transition-colors"
              title="Quay lại Bảng điều khiển"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                <History className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-foreground dark:text-white">Bài thi đã làm</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <History className="w-12 h-12 mb-4 text-muted-foreground dark:text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">Chưa có dữ liệu bài thi</p>
            <p className="text-sm">Bạn chưa hoàn thành bài thi nào.</p>
            <button
              onClick={() => navigate('/question-bank')}
              className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm"
            >
              Luyện thi ngay
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.results.map((result) => (
                <div
                  key={result.result_id}
                  className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
                >
                  <div className="p-5 flex-1 space-y-4">
                    {/* Header */}
                    <div>
                      <h3 className="text-base font-bold text-card-foreground line-clamp-2">
                        {result.exam_title || 'Đề thi không xác định'}
                      </h3>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-border">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          Điểm số (IRT)
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-lg font-bold ${
                              result.score !== null && result.score <= 19
                                ? 'text-rose-600 dark:text-rose-500'
                                : 'text-indigo-600 dark:text-indigo-400'
                            }`}
                          >
                            {result.score !== null ? result.score.toFixed(2) : '-'} / 60
                          </span>
                          {result.score !== null && (
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                                result.score <= 19
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              }`}
                            >
                              {result.score <= 19 ? 'Rớt' : 'Đậu'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Thống kê
                        </span>
                        <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                          {result.correct_answers}/{result.total_questions}
                        </span>
                      </div>
                    </div>

                    {/* Footer / Date */}
                    <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(result.completed_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>

                      <button
                        onClick={() => navigate(`/test/results/${result.result_id}/review`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                        title="Xem chi tiết câu trả lời"
                      >
                        <Eye className="w-3.5 h-3.5" /> Thêm
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {data.total_pages > 1 && (
              <div className="mt-8 flex items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm">
                <span className="text-sm text-muted-foreground font-medium">
                  Trang {page} / {data.total_pages}
                  <span className="mx-2">•</span>
                  Tổng cộng: {data.total} danh mục
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Trang trước
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={page >= data.total_pages}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
