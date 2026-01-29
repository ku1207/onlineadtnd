import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { NaverAdData } from "@/types/naverAd"

interface MorphemeCount {
  word: string
  count: number
}

// 광고 데이터에서 분석할 텍스트 추출
function extractTextFromAds(ads: NaverAdData[]): string {
  const textParts: string[] = []

  for (const ad of ads) {
    // 브랜드명
    if (ad.brand.name) textParts.push(ad.brand.name)

    // 광고 텍스트
    if (ad.adText.title) textParts.push(ad.adText.title)
    if (ad.adText.desc) textParts.push(ad.adText.desc)

    // 홍보문구
    if (ad.assets.promotionText) textParts.push(ad.assets.promotionText)

    // 사이트링크
    if (ad.assets.sitelinkText.length > 0) {
      textParts.push(...ad.assets.sitelinkText)
    }

    // 네이버 지도 태그
    if (ad.assets.naverMapTag.length > 0) {
      textParts.push(...ad.assets.naverMapTag)
    }

    // 썸네일 텍스트
    if (ad.assets.thumbNailText && ad.assets.thumbNailText.length > 0) {
      textParts.push(...ad.assets.thumbNailText)
    }
  }

  return textParts.join(" ")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ads = body.data as NaverAdData[]

    if (!ads || ads.length === 0) {
      return NextResponse.json(
        { error: "분석할 광고 데이터가 없습니다." },
        { status: 400 }
      )
    }

    // 텍스트 추출
    const textToAnalyze = extractTextFromAds(ads)

    if (!textToAnalyze.trim()) {
      return NextResponse.json(
        { error: "분석할 텍스트가 없습니다." },
        { status: 400 }
      )
    }

    // Claude API 키 확인
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    // Claude API 호출
    const client = new Anthropic({ apiKey })

    const prompt = `다음 한국어 광고 텍스트에서 형태소 분석을 수행해주세요.

텍스트:
${textToAnalyze}

작업 지시:
1. 텍스트를 형태소로 분리합니다.
2. 다음 품사는 제외합니다: 조사(JKS, JKC, JKG, JKO, JKB, JKV, JKQ, JX, JC), 어미(EP, EF, EC, ETN, ETM), 접사, 부호, 기호, 숫자, 영문자 단독
3. 남은 형태소(명사, 동사 어간, 형용사 어간, 부사 등 의미있는 단어)의 빈도를 카운트합니다.
4. 빈도순으로 내림차순 정렬합니다.

응답은 반드시 다음 JSON 형식으로만 답변해주세요. 다른 설명 없이 JSON만 출력하세요:
{
  "morphemes": [
    {"word": "단어1", "count": 10},
    {"word": "단어2", "count": 8},
    ...
  ]
}

중요: JSON 형식으로만 응답하세요. 마크다운 코드 블록이나 다른 텍스트 없이 순수 JSON만 출력하세요.`

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    // 응답에서 텍스트 추출
    const content = response.content[0]
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Claude API 응답 형식이 올바르지 않습니다." },
        { status: 500 }
      )
    }

    // JSON 파싱
    let morphemeResult: { morphemes: MorphemeCount[] }
    try {
      // JSON 블록이 있으면 추출
      let jsonText = content.text.trim()

      // 마크다운 코드 블록 제거
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7)
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3)
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3)
      }
      jsonText = jsonText.trim()

      morphemeResult = JSON.parse(jsonText)
    } catch {
      console.error("JSON 파싱 실패:", content.text)
      return NextResponse.json(
        { error: "형태소 분석 결과 파싱에 실패했습니다." },
        { status: 500 }
      )
    }

    // 결과 반환
    return NextResponse.json({
      morphemeCounts: morphemeResult.morphemes || [],
      totalWords: morphemeResult.morphemes?.length || 0,
    })
  } catch (error) {
    console.error("형태소 분석 오류:", error)
    return NextResponse.json(
      { error: "형태소 분석 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
