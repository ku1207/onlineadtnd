import { NextRequest, NextResponse } from "next/server"
import { extractInnerText, parseNaverAdText } from "@/lib/parseNaverAd"

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword")

  if (!keyword) {
    return NextResponse.json(
      { error: "keyword 파라미터가 필요합니다." },
      { status: 400 }
    )
  }

  const url = `https://ad.search.naver.com/search.naver?where=ad&query=${encodeURIComponent(keyword)}`

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `페이지 요청 실패: ${response.status}` },
        { status: 502 }
      )
    }

    const html = await response.text()
    const innerText = extractInnerText(html)
    const results = parseNaverAdText(innerText, keyword)

    return NextResponse.json({ innerText, results })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
