"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Search, Loader2, ExternalLink, Tag, Clock, Download, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NaverAdData } from "@/types/naverAd"

export default function Page1() {
  const router = useRouter()
  const [keyword, setKeyword] = useState("")
  const [results, setResults] = useState<NaverAdData[]>([])
  const [rawText, setRawText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState("")

  // 형태소 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState("")

  const handleSearch = async () => {
    const trimmed = keyword.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError("")
    setResults([])
    setRawText("")
    setSearched(true)
    setAnalysisError("")

    try {
      const response = await fetch(
        `/api/naver-ad?keyword=${encodeURIComponent(trimmed)}`
      )
      const data = await response.json()

      console.log("[page1] api response ok=", response.ok)
      console.log("[page1] innerText length=", (data.innerText || "").length)
      console.log("[page1] results count=", (data.results || []).length)
      if (data.debug) {
        console.log("[page1] debug=", data.debug)
        if (data.debug.thumbnails) {
          console.log("[page1] thumbnail debug=", JSON.stringify(data.debug.thumbnails, null, 2))
        }
      }

      if (!response.ok) {
        setError(data.error || "데이터를 가져오는데 실패했습니다.")
        return
      }

      // Prefer plain text for download; fallback to HTML only if text missing
      setRawText(data.outerTextRaw || data.innerText || data.html || "")
      setResults(data.results || [])
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadRaw = () => {
    if (!rawText) return
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `naver-ad-raw-${keyword.trim()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleAnalyze = async () => {
    if (results.length === 0) return

    setIsAnalyzing(true)
    setAnalysisError("")

    try {
      const response = await fetch("/api/morpheme-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: results }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAnalysisError(data.error || "형태소 분석에 실패했습니다.")
        return
      }

      // sessionStorage에 분석 결과 저장
      sessionStorage.setItem(
        "morphemeAnalysisData",
        JSON.stringify(data.morphemeCounts || [])
      )
      sessionStorage.setItem("morphemeAnalysisKeyword", keyword.trim())
      sessionStorage.setItem(
        "prompt2Result",
        JSON.stringify(data.prompt2Result || {})
      )

      // 분석 결과 페이지로 이동
      router.push("/page1/analysis")
    } catch {
      setAnalysisError("형태소 분석 중 오류가 발생했습니다.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 검색 전 화면 (ChatGPT 스타일 중앙 배치)
  if (!searched) {
    return (
      <div className="min-h-[calc(100vh-65px)] bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl px-6">
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              네이버 광고 인사이트 분석기
            </h1>
            <p className="text-gray-500">
              키워드를 입력하면 네이버 검색 광고 데이터를 수집하고 분석합니다
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="키워드를 입력하세요."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-12 h-14 text-lg border-gray-300 focus-visible:ring-blue-500 rounded-xl shadow-sm"
            />
            <Button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6 bg-blue-500 hover:bg-blue-600"
            >
              검색
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["자동차", "보험", "대출", "부동산", "여행"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setKeyword(suggestion)
                }}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 검색 후 화면
  return (
    <div className="min-h-[calc(100vh-65px)] bg-gray-50">
      {/* 상단 검색 영역 */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="relative max-w-xl mx-auto">
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
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  수집 결과
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadRaw}
                  className="text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  raw 파일 확인
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="text-xs"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <BarChart3 className="w-3.5 h-3.5 mr-1" />
                  )}
                  분석
                </Button>
              </div>
              <span className="text-sm text-gray-500">
                총 {results.length}개 광고
              </span>
            </div>

            {/* 형태소 분석 에러 */}
            {analysisError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {analysisError}
              </div>
            )}

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
                  {/* 광고 텍스트 + 썸네일 이미지 */}
                  <div className="flex gap-4">
                    {/* 왼쪽: 광고 텍스트 */}
                    <div className="flex-1 min-w-0">
                      <SectionLabel icon={<Tag className="w-3.5 h-3.5" />} text="광고 텍스트" />
                      <p className="font-medium text-gray-900 mt-1">
                        {ad.adText.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {ad.adText.desc}
                      </p>
                    </div>

                    {/* 오른쪽: 썸네일 이미지 */}
                    {ad.assets.thumbNailImages && ad.assets.thumbNailImages.length > 0 && (
                      <div className="flex gap-2 flex-shrink-0">
                        {ad.assets.thumbNailImages.map((src, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <img
                              src={src}
                              alt={ad.assets.thumbNailText?.[i] || `썸네일 ${i + 1}`}
                              className="w-[72px] h-[72px] object-cover rounded-lg border border-gray-200"
                            />
                            {ad.assets.thumbNailText?.[i] && (
                              <span className="text-[11px] text-gray-500 mt-1 text-center">
                                {ad.assets.thumbNailText[i]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 홍보문구 */}
                  {ad.assets.promotionText && (
                    <div>
                      <SectionLabel text="홍보문구" />
                      <p className="text-sm text-gray-700 mt-1 bg-yellow-50 px-3 py-2 rounded">
                        {ad.assets.promotionText}
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

                  {/* 네이버 지도 태그 */}
                  {ad.assets.naverMapTag.length > 0 && (
                    <div>
                      <SectionLabel text="네이버 지도 태그" />
                      <div className="flex flex-wrap gap-2 mt-1">
                        {ad.assets.naverMapTag.map((text, i) => (
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

                  {/* 방문자 리뷰 */}
                  {ad.assets.visitorReview && (
                    <div>
                      <SectionLabel text="방문자 리뷰" />
                      <p className="text-sm text-gray-700 mt-1">
                        {ad.assets.visitorReview}
                      </p>
                    </div>
                  )}

                  {/* 가격 정보 */}
                  {ad.assets.naverMapPriceLink && (
                    <div>
                      <SectionLabel text="가격 정보" />
                      <p className="text-sm text-gray-700 mt-1">
                        {ad.assets.naverMapPriceLink}
                      </p>
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
