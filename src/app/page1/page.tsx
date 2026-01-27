"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Search, Loader2, ExternalLink, Tag, Clock } from "lucide-react"
import { NaverAdData } from "@/types/naverAd"

export default function Page1() {
  const [keyword, setKeyword] = useState("")
  const [results, setResults] = useState<NaverAdData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState("")

  const handleSearch = async () => {
    const trimmed = keyword.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError("")
    setResults([])
    setSearched(true)

    try {
      const response = await fetch(
        `/api/naver-ad?keyword=${encodeURIComponent(trimmed)}`
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "데이터를 가져오는데 실패했습니다.")
        return
      }

      setResults(data.results || [])
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-gray-50">
      {/* 상단 검색 영역 */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">
              네이버 광고 인사이트 분석기
            </h1>
            <p className="text-gray-500">
              키워드를 입력하면 네이버 검색 광고 데이터를 수집하고 분석합니다
            </p>
          </div>

          <div className="relative max-w-xl mx-auto mt-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="키워드를 입력하세요."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-11 h-12 text-base border-gray-300 focus-visible:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 결과 영역 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="mt-4 text-gray-500">
              데이터를 수집하고 분석 중입니다...
            </p>
          </div>
        )}

        {/* 에러 상태 */}
        {!isLoading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 결과 없음 */}
        {!isLoading && !error && searched && results.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">
              검색 결과가 없습니다.
            </p>
          </div>
        )}

        {/* 결과 목록 */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-6">
            {/* 요약 */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                분석 결과
              </h2>
              <span className="text-sm text-gray-500">
                총 {results.length}개 광고
              </span>
            </div>

            {/* 광고 카드 목록 */}
            {results.map((ad) => (
              <Card key={ad.rank} className="overflow-hidden bg-white">
                <CardHeader className="bg-gray-50 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                        {ad.rank}
                      </span>
                      {ad.brand.name}
                    </CardTitle>
                    {ad.payments.naverpay === "Y" && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        네이버페이
                      </span>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1 ml-9">
                    <ExternalLink className="w-3 h-3" />
                    {ad.brand.domain}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-5 space-y-5">
                  {/* 광고 텍스트 */}
                  <div>
                    <SectionLabel icon={<Tag className="w-3.5 h-3.5" />} text="광고 텍스트" />
                    <p className="font-medium text-gray-900 mt-1">
                      {ad.adText.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {ad.adText.desc}
                    </p>
                  </div>

                  {/* 하이라이트 */}
                  {ad.assets.highlights && (
                    <div>
                      <SectionLabel text="하이라이트" />
                      <p className="text-sm text-gray-700 mt-1 bg-yellow-50 px-3 py-2 rounded">
                        {ad.assets.highlights}
                      </p>
                    </div>
                  )}

                  {/* 사이트링크 */}
                  {ad.assets.sitelinkText.length > 0 && (
                    <div>
                      <SectionLabel text="사이트링크" />
                      <div className="flex flex-wrap gap-2 mt-1">
                        {ad.assets.sitelinkText.map((link, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100"
                          >
                            {link}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 썸네일 텍스트 */}
                  {ad.assets.thumbnailText.length > 0 && (
                    <div>
                      <SectionLabel text="썸네일 텍스트" />
                      <div className="flex flex-wrap gap-2 mt-1">
                        {ad.assets.thumbnailText.map((text, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                          >
                            {text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 광고 집행 기간 */}
                  {ad.meta.adRunPeriod.label && (
                    <div>
                      <SectionLabel
                        icon={<Clock className="w-3.5 h-3.5" />}
                        text="광고 집행 기간"
                      />
                      <p className="text-sm text-gray-700 mt-1">
                        {ad.meta.adRunPeriod.label}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* JSON 원본 데이터 */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">JSON 데이터</CardTitle>
                <CardDescription>
                  파싱된 광고 데이터의 JSON 형태
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-xs max-h-[500px] leading-relaxed">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({
  icon,
  text,
}: {
  icon?: React.ReactNode
  text: string
}) {
  return (
    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
      {icon}
      {text}
    </h4>
  )
}
