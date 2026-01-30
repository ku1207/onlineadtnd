"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, ArrowLeft, Loader2, Sparkles, Lightbulb } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import * as XLSX from "xlsx"

import { NaverAdData } from "@/types/naverAd"

interface MorphemeCount {
  word: string
  count: number
}

interface AssetOptimizationItem {
  [key: string]: string
}

interface Prompt2Result {
  market_winning_logic: string
  strategic_differentiation: string
  asset_optimization_plan: AssetOptimizationItem[]
  operational_roadmap: string
}

interface AdCreative {
  version: string
  adText: {
    title: string
    desc: string
  }
  assets: {
    promotionText: string
    siteLink: string[]
    thumbNailText: string[]
  }
}

const VERSION_LABEL_MAP: Record<string, string> = {
  "Winning Logic": "안정적 효율 소재",
  "Differentiation": "차별화 소재",
  "Action Oriented": "행동 유도 소재",
}

const VERSION_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  "Winning Logic": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Differentiation": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Action Oriented": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
}

// 문장 단위로 분리하는 함수
// 한국어 문장 종결 패턴 (다., 요., 니다., 세요. 등)과 일반 문장 부호를 기준으로 분리
const splitIntoSentences = (text: string): string[] => {
  if (!text) return []

  // 문장 종결 패턴: 마침표, 느낌표, 물음표 뒤에 공백이나 문장 끝이 오는 경우
  // 단, 숫자 뒤의 마침표(1. 2. 등)는 제외
  const sentences = text
    .split(/(?<=[.!?])(?=\s|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  return sentences
}

interface Prompt1Result {
  market_standard_formula: string
  extension_asset_landscape: string
  morpheme_intent_clustering: string[]
  message_saturation: string
}

export default function AnalysisPage() {
  const router = useRouter()
  const [morphemeData, setMorphemeData] = useState<MorphemeCount[]>([])
  const [keyword, setKeyword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [prompt1Result, setPrompt1Result] = useState<Prompt1Result | null>(null)
  const [prompt2Result, setPrompt2Result] = useState<Prompt2Result | null>(null)
  const [adCreatives, setAdCreatives] = useState<AdCreative[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [insightStep, setInsightStep] = useState<0 | 1 | 2>(0) // 0: 미시작, 1: 1단계 완료, 2: 2단계 완료
  const [isInsightLoading, setIsInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState("")
  const [naverAdData, setNaverAdData] = useState<NaverAdData[]>([])

  useEffect(() => {
    // sessionStorage에서 데이터 로드
    const storedData = sessionStorage.getItem("morphemeAnalysisData")
    const storedKeyword = sessionStorage.getItem("morphemeAnalysisKeyword")
    const storedAdData = sessionStorage.getItem("naverAdData")

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData)
        setMorphemeData(parsed)
      } catch {
        console.error("형태소 데이터 파싱 실패")
      }
    }

    if (storedKeyword) {
      setKeyword(storedKeyword)
    }

    if (storedAdData) {
      try {
        const parsed = JSON.parse(storedAdData)
        setNaverAdData(parsed)
      } catch {
        console.error("광고 데이터 파싱 실패")
      }
    }

    // prompt1Result 로드
    const storedPrompt1 = sessionStorage.getItem("prompt1Result")
    if (storedPrompt1) {
      try {
        const parsed = JSON.parse(storedPrompt1)
        if (parsed && Object.keys(parsed).length > 0 && parsed.market_standard_formula) {
          setPrompt1Result(parsed)
          setInsightStep(1) // 1단계 완료 상태로 설정
        }
      } catch {
        console.error("프롬프트1 결과 파싱 실패")
      }
    }

    // prompt2Result 로드
    const storedPrompt2 = sessionStorage.getItem("prompt2Result")
    if (storedPrompt2) {
      try {
        const parsed = JSON.parse(storedPrompt2)
        // 빈 객체가 아닌 경우에만 설정
        if (parsed && Object.keys(parsed).length > 0 && parsed.market_winning_logic) {
          setPrompt2Result(parsed)
          setInsightStep(2) // 2단계 완료 상태로 설정
        }
      } catch {
        console.error("프롬프트2 결과 파싱 실패")
      }
    }

    setIsLoading(false)
  }, [])

  // 막대 그래프 색상 생성 (빈도가 높을수록 진한 파란색)
  const getBarColor = (index: number, total: number) => {
    // 가장 진한 색상에서 시작해서 점점 옅어지는 그라데이션
    const darkest = { r: 30, g: 64, b: 175 }   // #1E40AF (진한 파란색)
    const lightest = { r: 219, g: 234, b: 254 } // #DBEAFE (옅은 파란색)

    // index 0 = 가장 진한 색, index가 커질수록 옅어짐
    const ratio = total > 1 ? index / (total - 1) : 0

    const r = Math.round(darkest.r + (lightest.r - darkest.r) * ratio)
    const g = Math.round(darkest.g + (lightest.g - darkest.g) * ratio)
    const b = Math.round(darkest.b + (lightest.b - darkest.b) * ratio)

    return `rgb(${r}, ${g}, ${b})`
  }

  // AI 인사이트 생성 (2단계로 분리)
  const handleGenerateInsight = async () => {
    if (morphemeData.length === 0 || naverAdData.length === 0 || isInsightLoading) return

    setIsInsightLoading(true)
    setInsightError("")

    try {
      // 현재 단계에 따라 다른 API 호출
      if (insightStep === 0) {
        // Step 1: 시장 분석
        const response = await fetch("/api/ai-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: 1,
            ads: naverAdData,
            morphemeCounts: morphemeData,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "AI 인사이트 생성 실패 (1단계)")
        }

        const data = await response.json()
        setPrompt1Result(data.prompt1Result)
        setInsightStep(1)
        
        // sessionStorage에 저장
        sessionStorage.setItem("prompt1Result", JSON.stringify(data.prompt1Result))
      } else if (insightStep === 1 && prompt1Result) {
        // Step 2: 전략 인사이트
        const response = await fetch("/api/ai-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: 2,
            prompt1Result: prompt1Result,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "AI 인사이트 생성 실패 (2단계)")
        }

        const data = await response.json()
        setPrompt2Result(data.prompt2Result)
        setInsightStep(2)
        
        // sessionStorage에도 저장
        sessionStorage.setItem("prompt2Result", JSON.stringify(data.prompt2Result))
      }
    } catch (error) {
      console.error("AI 인사이트 생성 오류:", error)
      setInsightError(error instanceof Error ? error.message : "AI 인사이트 생성 중 오류가 발생했습니다.")
    } finally {
      setIsInsightLoading(false)
    }
  }

  // AI 소재 생성
  const handleGenerateCreatives = async () => {
    if (!prompt2Result || isGenerating) return

    setIsGenerating(true)
    try {
      const response = await fetch("/api/creative-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt2Result }),
      })

      if (!response.ok) {
        throw new Error("소재 생성 실패")
      }

      const data = await response.json()
      setAdCreatives(data.ad_creatives || [])
    } catch (error) {
      console.error("소재 생성 오류:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  // 엑셀 다운로드
  const handleDownloadExcel = () => {
    if (morphemeData.length === 0) return

    // 워크시트 데이터 생성
    const wsData = [
      ["형태소", "빈도수"], // 헤더
      ...morphemeData.map((item) => [item.word, item.count])
    ]

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // 열 너비 설정
    ws["!cols"] = [
      { wch: 20 }, // 형태소 열 너비
      { wch: 10 }, // 빈도수 열 너비
    ]

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "형태소분석")

    // 파일 다운로드
    const fileName = keyword
      ? `형태소분석_${keyword}_${new Date().toISOString().split("T")[0]}.xlsx`
      : `형태소분석_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // 뒤로가기
  const handleBack = () => {
    router.back()
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-65px)] bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (morphemeData.length === 0) {
    return (
      <div className="min-h-[calc(100vh-65px)] bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">분석 결과가 없습니다.</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          돌아가기
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 뒤로가기 버튼 */}
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          수집 결과로 돌아가기
        </Button>

        {/* 형태소 분석 결과 카드 */}
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                형태소 분석 결과
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                형태소 raw 확인
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={morphemeData.slice(0, 20)}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="word"
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`${value}회`, "빈도"]}
                    labelFormatter={(label) => `키워드: ${label}`}
                  />
                  <Bar dataKey="count" name="빈도">
                    {morphemeData.slice(0, 20).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(index, Math.min(morphemeData.length, 20))} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 text-sm text-gray-500 text-center">
              상위 20개 키워드 표시 (총 {morphemeData.length}개 추출)
            </div>

            {/* AI 인사이트 생성 버튼 */}
            {insightStep < 2 && (
              <div className="mt-6 flex flex-col items-center">
                {insightError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                    {insightError}
                  </div>
                )}
                <Button
                  onClick={handleGenerateInsight}
                  disabled={isInsightLoading || naverAdData.length === 0}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2.5"
                >
                  {isInsightLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {insightStep === 0 ? "AI 인사이트 생성 중 (1/2단계)..." : "AI 인사이트 생성 중 (2/2단계)..."}
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 mr-2" />
                      {insightStep === 0 ? "AI 인사이트 생성 (1/2단계)" : "AI 인사이트 생성 (2/2단계)"}
                    </>
                  )}
                </Button>
                <p className="mt-2 text-xs text-gray-400">
                  {insightStep === 0 
                    ? "형태소 분석 결과를 바탕으로 시장 분석을 수행합니다" 
                    : "시장 분석 결과를 바탕으로 전략적 인사이트를 생성합니다"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 전략 인사이트 결과 */}
        {prompt2Result && (
          <Card className="bg-white mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">전략 인사이트</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCreatives}
                  disabled={isGenerating}
                  className="text-xs"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      AI 소재 생성
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 시장 승리 공식 */}
              <div>
                <h4 className="text-sm font-semibold text-blue-700 mb-2">
                  시장 승리 공식 (Market Winning Logic)
                </h4>
                <div className="text-sm text-gray-700 bg-blue-50 p-4 rounded-lg leading-relaxed space-y-2">
                  {splitIntoSentences(prompt2Result.market_winning_logic).map((sentence, idx) => (
                    <p key={idx}>{sentence}</p>
                  ))}
                </div>
              </div>

              {/* 전략적 차별화 */}
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2">
                  전략적 차별화 (Strategic Differentiation)
                </h4>
                <div className="text-sm text-gray-700 bg-green-50 p-4 rounded-lg leading-relaxed space-y-2">
                  {splitIntoSentences(prompt2Result.strategic_differentiation).map((sentence, idx) => (
                    <p key={idx}>{sentence}</p>
                  ))}
                </div>
              </div>

              {/* 자산 최적화 방안 */}
              <div>
                <h4 className="text-sm font-semibold text-purple-700 mb-2">
                  자산 최적화 방안 (Asset Optimization Plan)
                </h4>
                <div className="text-sm text-gray-700 bg-purple-50 p-4 rounded-lg leading-relaxed space-y-3">
                  {prompt2Result.asset_optimization_plan.map((item, idx) => {
                    const key = Object.keys(item)[0]
                    const value = item[key]
                    return (
                      <div key={idx} className="border-l-2 border-purple-300 pl-3">
                        <span className="font-medium text-purple-800">{key}</span>
                        <div className="mt-1 space-y-1">
                          {splitIntoSentences(value).map((sentence, sIdx) => (
                            <p key={sIdx}>{sentence}</p>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 운영 로드맵 */}
              <div>
                <h4 className="text-sm font-semibold text-orange-700 mb-2">
                  운영 로드맵 (Operational Roadmap)
                </h4>
                <div className="text-sm text-gray-700 bg-orange-50 p-4 rounded-lg leading-relaxed space-y-2">
                  {splitIntoSentences(prompt2Result.operational_roadmap).map((sentence, idx) => (
                    <p key={idx}>{sentence}</p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI 소재 생성 결과 */}
        {adCreatives.length > 0 && (
          <Card className="bg-white mt-6">
            <CardHeader>
              <CardTitle className="text-lg">AI 소재 생성 결과</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {adCreatives.map((creative, idx) => {
                const colors = VERSION_COLOR_MAP[creative.version] || {
                  bg: "bg-gray-50",
                  text: "text-gray-700",
                  border: "border-gray-200",
                }
                const label = VERSION_LABEL_MAP[creative.version] || creative.version

                return (
                  <div key={idx}>
                    {/* 소재 유형 라벨 */}
                    <div className="mb-3">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                        {label}
                      </span>
                    </div>

                    {/* 네이버 광고 미리보기 */}
                    <div className={`border ${colors.border} rounded-lg p-5 bg-white`}>
                      {/* 브랜드 정보 */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[13px] font-medium text-gray-800">brand.name</span>
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-[13px] text-gray-500">brand.domain</span>
                      </div>

                      {/* 본문 + 썸네일 영역 */}
                      <div className="flex gap-4">
                        {/* 왼쪽: 제목 + 설명 + 홍보문구 + 사이트링크 */}
                        <div className="flex-1 min-w-0">
                          {/* 제목 */}
                          <h3 className="text-[15px] font-bold text-[#00834e] leading-snug mb-1.5">
                            {creative.adText.title}
                          </h3>

                          {/* 설명 */}
                          <p className="text-[13px] text-gray-600 leading-relaxed mb-3 line-clamp-2">
                            {creative.adText.desc}
                          </p>

                          {/* 홍보문구 */}
                          {creative.assets.promotionText && (
                            <div className="flex items-center gap-1.5 mb-3">
                              <span className="inline-flex items-center text-[11px] font-medium text-[#00834e] border border-[#00834e]/30 rounded-full px-2 py-0.5">
                                이벤트
                              </span>
                              <span className="text-[12px] text-gray-600">
                                {creative.assets.promotionText}
                              </span>
                            </div>
                          )}

                          {/* 사이트링크 */}
                          {creative.assets.siteLink && creative.assets.siteLink.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {creative.assets.siteLink.map((link, linkIdx) => (
                                <span
                                  key={linkIdx}
                                  className="inline-block text-[12px] text-gray-700 border border-gray-200 rounded px-2.5 py-1 bg-gray-50"
                                >
                                  {link}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 오른쪽: 썸네일 */}
                        {creative.assets.thumbNailText && creative.assets.thumbNailText.length > 0 && (
                          <div className="flex gap-2 flex-shrink-0">
                            {creative.assets.thumbNailText.map((text, tIdx) => (
                              <div key={tIdx} className="flex flex-col items-center">
                                <div className="w-[72px] h-[72px] bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                                  <span className="text-gray-400 text-[10px]">IMG</span>
                                </div>
                                <span className="text-[11px] text-gray-600 mt-1.5 text-center">
                                  {text}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
