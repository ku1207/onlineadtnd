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
import { Download, ArrowLeft, Loader2 } from "lucide-react"
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

interface MorphemeCount {
  word: string
  count: number
}

interface Prompt2Result {
  market_winning_logic: string
  strategic_differentiation: string
  asset_optimization_plan: string
  operational_roadmap: string
}

export default function AnalysisPage() {
  const router = useRouter()
  const [morphemeData, setMorphemeData] = useState<MorphemeCount[]>([])
  const [keyword, setKeyword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [prompt2Result, setPrompt2Result] = useState<Prompt2Result | null>(null)

  useEffect(() => {
    // sessionStorage에서 데이터 로드
    const storedData = sessionStorage.getItem("morphemeAnalysisData")
    const storedKeyword = sessionStorage.getItem("morphemeAnalysisKeyword")

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

    const storedPrompt2 = sessionStorage.getItem("prompt2Result")
    if (storedPrompt2) {
      try {
        const parsed = JSON.parse(storedPrompt2)
        setPrompt2Result(parsed)
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
            <div className="mt-4 text-sm text-gray-500 text-center">
              상위 20개 키워드 표시 (총 {morphemeData.length}개 추출)
            </div>
          </CardContent>
        </Card>

        {/* 전략 인사이트 결과 */}
        {prompt2Result && (
          <Card className="bg-white mt-6">
            <CardHeader>
              <CardTitle className="text-lg">전략 인사이트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 시장 승리 공식 */}
              <div>
                <h4 className="text-sm font-semibold text-blue-700 mb-2">
                  시장 승리 공식 (Market Winning Logic)
                </h4>
                <p className="text-sm text-gray-700 bg-blue-50 p-4 rounded-lg leading-relaxed">
                  {prompt2Result.market_winning_logic}
                </p>
              </div>

              {/* 전략적 차별화 */}
              <div>
                <h4 className="text-sm font-semibold text-green-700 mb-2">
                  전략적 차별화 (Strategic Differentiation)
                </h4>
                <p className="text-sm text-gray-700 bg-green-50 p-4 rounded-lg leading-relaxed">
                  {prompt2Result.strategic_differentiation}
                </p>
              </div>

              {/* 자산 최적화 방안 */}
              <div>
                <h4 className="text-sm font-semibold text-purple-700 mb-2">
                  자산 최적화 방안 (Asset Optimization Plan)
                </h4>
                <p className="text-sm text-gray-700 bg-purple-50 p-4 rounded-lg leading-relaxed">
                  {prompt2Result.asset_optimization_plan}
                </p>
              </div>

              {/* 운영 로드맵 */}
              <div>
                <h4 className="text-sm font-semibold text-orange-700 mb-2">
                  운영 로드맵 (Operational Roadmap)
                </h4>
                <p className="text-sm text-gray-700 bg-orange-50 p-4 rounded-lg leading-relaxed">
                  {prompt2Result.operational_roadmap}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
