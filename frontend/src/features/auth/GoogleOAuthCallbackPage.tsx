import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'

function sanitizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/dashboard'
  }
  return nextPath
}

export default function GoogleOAuthCallbackPage() {
  const navigate = useNavigate()
  const { completeOAuthLogin } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const finishGoogleLogin = async () => {
      const fragment = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const params = new URLSearchParams(fragment)
      const oauthError = params.get('error')
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const nextPath = sanitizeNextPath(params.get('next'))

      if (oauthError) {
        setError(oauthError)
        return
      }

      if (!accessToken) {
        setError('Không nhận được access token từ Google OAuth.')
        return
      }

      const result = await completeOAuthLogin({ accessToken, refreshToken })
      if (!result.success) {
        setError(result.error || 'Đăng nhập Google thất bại.')
        return
      }

      window.history.replaceState(null, '', window.location.pathname)
      navigate(nextPath, { replace: true })
    }

    void finishGoogleLogin()
  }, [completeOAuthLogin, navigate])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Đang hoàn tất đăng nhập Google</CardTitle>
          <CardDescription>
            {error
              ? 'Phiên đăng nhập Google chưa thể hoàn tất. Bạn có thể quay lại trang đăng nhập để thử lại.'
              : 'Hệ thống đang xác thực tài khoản và khởi tạo phiên làm việc của bạn.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
              <Button asChild className="w-full">
                <Link to="/login">Quay lại đăng nhập</Link>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
              <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              Đang đồng bộ thông tin người dùng...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
