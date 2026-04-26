import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Star, X, MessageSquare, Send } from 'lucide-react'

import { apiFetch } from '@/lib/apiClient'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface SystemFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  sourcePage?: string
}

export const SystemFeedbackModal: React.FC<SystemFeedbackModalProps> = ({
  isOpen,
  onClose,
  sourcePage,
}) => {
  const [rating, setRating] = useState<number>(0)
  const [hoveredRating, setHoveredRating] = useState<number>(0)
  const [comment, setComment] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [isSuccess, setIsSuccess] = useState<boolean>(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      setError('Vui lòng chọn mức độ đánh giá bằng cách click vào các ngôi sao bên trên.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const response = await apiFetch(`${API_BASE}/api/system-feedbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating_score: rating,
          comment_text: comment,
          source_page: sourcePage,
          feedback_tags: [],
        }),
      })

      if (!response.ok) {
        throw new Error('Can not submit system feedback')
      }

      setIsSuccess(true)
      setTimeout(() => {
        onClose()
        setIsSuccess(false)
        setRating(0)
        setComment('')
      }, 1500)
    } catch (err) {
      console.error(err)
      setError('Đã có lỗi xảy ra khi gửi đánh giá hệ thống. Vui lòng thử lại sau.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-[1000] grid place-items-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 shrink-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Đánh giá hệ thống
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h4 className="text-xl font-medium text-slate-800 dark:text-slate-100 mb-2">
              Cảm ơn bạn!
            </h4>
            <p className="text-slate-500 dark:text-slate-400">
              Góp ý của bạn đã được lưu để cải thiện trải nghiệm hệ thống.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 text-center">
                Bạn đánh giá trải nghiệm hệ thống như thế nào?{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= (hoveredRating || rating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-md'
                          : 'text-slate-300 dark:text-slate-600'
                      } transition-colors duration-200`}
                    />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
                {hoveredRating || rating ? `${hoveredRating || rating}/5 sao` : 'Chưa chọn số sao'}
              </p>
              {error && (
                <p className="text-red-500 text-sm text-center mt-3 animate-in fade-in slide-in-from-top-1">
                  {error}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Nội dung góp ý chi tiết (Tùy chọn)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="VD: Menu khó tìm, thao tác chưa mượt ở trang thi..."
                className="w-full min-h-[100px] p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 mr-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transform active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Gửi đánh giá
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
