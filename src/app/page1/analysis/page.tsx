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

export default function AnalysisPage() {
  const router = useRouter()
  const [morphemeData, setMorphemeData] = useState<MorphemeCount[]>([])
  const [keyword, setKeyword] = useState("")
  const [isLoading, setIsLoading] = useState(true)

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

    setIsLoading(false)
  }, [])

  // 막대 그래프 색상 생성
  const getBarColor = (index: number) => {
    const colors = [
      "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE", "#DBEAFE",
      "#2563EB", "#1D4ED8", "#1E40AF", "#1E3A8A", "#172554"
    ]
    return colors[index % colors.length]
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
                      <Cell key={`cell-${index}`} fill={getBarColor(index)} />
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
      </div>
    </div>
  )
}
