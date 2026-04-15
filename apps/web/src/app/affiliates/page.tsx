'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/header'

import { fetchApi } from '@/lib/api'
import { useAccount } from '@/contexts/account-context'

const WORKER_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface RefRoute {
  refCode: string
  name: string
  friendCount: number
  clickCount: number
  latestAt: string | null
}

interface RefSummaryData {
  routes: RefRoute[]
  totalFriends: number
  friendsWithRef: number
  friendsWithoutRef: number
}

interface RefFriend {
  id: string
  displayName: string
  trackedAt: string | null
}

interface RefDetailData {
  refCode: string
  name: string
  friends: RefFriend[]
}

export default function AttributionPage() {
  const { selectedAccountId } = useAccount()
  const [summary, setSummary] = useState<RefSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [detail, setDetail] = useState<RefDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', originalUrl: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const query = selectedAccountId ? `?lineAccountId=${selectedAccountId}` : ''
      const res = await fetchApi<{ success: boolean; data: RefSummaryData }>(`/api/analytics/ref-summary${query}`)
      setSummary(res.data)
    } catch {
      // silent
    }
    setLoading(false)
  }, [selectedAccountId])

  useEffect(() => {
    loadSummary()
    // Refresh when tab becomes visible
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadSummary() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loadSummary])

  const handleRowClick = async (refCode: string) => {
    if (selectedRef === refCode) {
      setSelectedRef(null)
      setDetail(null)
      return
    }
    setSelectedRef(refCode)
    setDetailLoading(true)
    try {
      const query = selectedAccountId ? `?lineAccountId=${selectedAccountId}` : ''
      const res = await fetchApi<{ success: boolean; data: RefDetailData }>(`/api/analytics/ref/${encodeURIComponent(refCode)}${query}`)
      setDetail(res.data)
    } catch {
      setDetail(null)
    }
    setDetailLoading(false)
  }

  const handleCopy = async (refCode: string) => {
    const url = `${WORKER_BASE}/auth/line?ref=${encodeURIComponent(refCode)}`
    await navigator.clipboard.writeText(url)
    setCopiedCode(refCode)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleCreate = async () => {
    setCreateError(null)
    if (!form.name.trim() || !form.originalUrl.trim()) {
      setCreateError('経路名とリンク先URLは必須です')
      return
    }
    setCreating(true)
    try {
      const res = await fetchApi<{ success: boolean; data: { trackingUrl?: string } }>(
        '/api/tracked-links',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, originalUrl: form.originalUrl }),
        }
      )
      setCreatedUrl(res.data.trackingUrl ?? null)
      setForm({ name: '', originalUrl: '' })
      await loadSummary()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '作成に失敗しました')
    }
    setCreating(false)
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  return (
    <div>
      <Header
        title="流入経路分析"
        description="ref コード別の友だち獲得・クリック実績"
        action={
          <button
            onClick={() => {
              setShowCreate((v) => !v)
              setCreatedUrl(null)
              setCreateError(null)
            }}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#06C755' }}
          >
            {showCreate ? 'キャンセル' : '+ 新規流入経路'}
          </button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">新規流入経路を作成</h2>
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">経路名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="例: X投稿キャンペーン"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">リンク先URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="https://line.me/R/ti/p/..."
                value={form.originalUrl}
                onChange={(e) => setForm({ ...form, originalUrl: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">通常は LINE 友だち追加リンク(https://line.me/R/ti/p/... など)</p>
            </div>
            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{createError}</div>
            )}
            {createdUrl && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                <p className="font-medium mb-1">作成しました。以下の短縮URLをシェアしてください:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all bg-white rounded px-2 py-1 border border-green-200">{createdUrl}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdUrl)}
                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
                  >
                    コピー
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#06C755' }}
              >
                {creating ? '作成中...' : '作成'}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setForm({ name: '', originalUrl: '' })
                  setCreatedUrl(null)
                  setCreateError(null)
                }}
                className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm text-gray-500">総友だち数</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{summary.totalFriends}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm text-gray-500">ref 経由</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{summary.friendsWithRef}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm text-gray-500">ref 不明</p>
            <p className="text-3xl font-bold text-gray-400 mt-1">{summary.friendsWithoutRef}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-sm text-gray-500">経路数</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{summary.routes.length}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          読み込み中...
        </div>
      ) : !summary || summary.routes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          流入経路がまだ登録されていません
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ref コード</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">経路名</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">友だち数</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">クリック数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最新追加日</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summary.routes.map((route) => {
                const authUrl = `${WORKER_BASE}/auth/line?ref=${encodeURIComponent(route.refCode)}`
                const isExpanded = selectedRef === route.refCode
                return (
                  <>
                    <tr
                      key={route.refCode}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(route.refCode)}
                    >
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{route.refCode}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{route.name}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{route.friendCount}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{route.clickCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(route.latestAt)}</td>
                      <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 truncate max-w-[180px]">{authUrl}</span>
                          <button
                            onClick={() => handleCopy(route.refCode)}
                            className="text-xs text-blue-500 hover:text-blue-700 shrink-0"
                          >
                            {copiedCode === route.refCode ? 'コピー済' : 'コピー'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${route.refCode}-detail`}>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          {detailLoading ? (
                            <p className="text-sm text-gray-400">読み込み中...</p>
                          ) : detail && detail.friends.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                                このルートから追加した友だち ({detail.friends.length}人)
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {detail.friends.map((f) => (
                                  <div key={f.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                                    <span className="text-sm text-gray-800 font-medium truncate">{f.displayName}</span>
                                    <span className="text-xs text-gray-400 ml-2 shrink-0">{formatDate(f.trackedAt)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">このルートから追加した友だちはまだいません</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
