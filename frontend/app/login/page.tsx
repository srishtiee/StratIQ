'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart3, ArrowRight, Zap, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const sb = getSupabaseBrowser()
      const { error: signInError } = await sb.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }
      // The proxy will redirect /login to /dashboard automatically once the cookie is set,
      // but we push proactively so the URL bar updates immediately.
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Gradient + Content */}
      <div className="hidden lg:flex lg:w-3/5 bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -ml-20 -mb-20" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">StratIQ</h1>
              <p className="text-xs text-indigo-200">AI-Native Executive Platform</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="mb-16">
            <p className="text-4xl font-bold text-white leading-tight mb-2">
              AI-native decisions.<br />Boardroom to action.
            </p>
            <p className="text-indigo-100 text-lg mt-4">Transform executive decision-making with real-time insights and AI-powered recommendations.</p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Zap className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Real-time Intelligence</h3>
                <p className="text-indigo-100 text-xs mt-1">Instant KPI insights, people analytics, and customer health scoring</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Users className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">People Intelligence</h3>
                <p className="text-indigo-100 text-xs mt-1">Identify attrition risks, compensation gaps, and retention opportunities</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <TrendingUp className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Recommended Actions</h3>
                <p className="text-indigo-100 text-xs mt-1">AI-driven recommendations with one-click execution for immediate impact</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-indigo-200 text-xs">
          <p>© 2025 StratIQ. All rights reserved.</p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-indigo-500 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">StratIQ</span>
          </div>

          {/* Form container */}
          <div className="bg-white rounded-xl border border-[#e8e8ef] p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-500">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white border-[#e8e8ef] text-gray-800 placeholder:text-gray-400"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white border-[#e8e8ef] text-gray-800 placeholder:text-gray-400"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-sm gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#e8e8ef]">
              <Link
                href="#"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Demo notice */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Demo: srishti.bankar@acme.com / StratIQ2026!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
