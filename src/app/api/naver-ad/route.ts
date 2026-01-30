import { NextRequest, NextResponse } from "next/server"
import {
  extractInnerText,
  parseNaverAdText,
  getOuterTextRaw,
  extractThumbnailImages,
} from "@/lib/parseNaverAd"

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
    console.log("[naver-ad] incoming keyword=", keyword)

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Referer: "https://www.naver.com/",
        "Accept-Charset": "utf-8",
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `페이지 요청 실패: ${response.status}` },
        { status: 502 }
      )
    }

    const html = await response.text()
    console.log(
      "[naver-ad] fetched html",
      "status=",
      response.status,
      "length=",
      html.length,
      "content-type=",
      response.headers.get("content-type")
    )

    const innerText = extractInnerText(html)
    const outerTextRaw = getOuterTextRaw(html)
    console.log(
      "[naver-ad] innerText length=",
      innerText.length,
      "head sample=",
      innerText.slice(0, 300)
    )

    if (innerText.length === 0) {
      console.warn(
        "[naver-ad] innerText empty after extract. html head snippet=",
        html.slice(0, 500)
      )
    }

    const { thumbnails: thumbnailsByBlock, debug: thumbDebug } = extractThumbnailImages(html)
    console.log("[naver-ad] thumbnailsByBlock=", JSON.stringify(thumbnailsByBlock))
    const results = parseNaverAdText(innerText, keyword, thumbnailsByBlock)
    console.log("[naver-ad] parsed results count=", results.length)
    console.log("[naver-ad] first lines=", innerText.split("\n").slice(0, 40))

    return NextResponse.json({
      html,
      innerText,
      outerTextRaw,
      results,
      debug: {
        url,
        status: response.status,
        htmlLength: html.length,
        innerTextLength: innerText.length,
        outerTextRawLength: outerTextRaw.length,
        contentType: response.headers.get("content-type"),
        thumbnails: thumbDebug,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
