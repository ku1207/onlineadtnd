export const runtime = "nodejs"
export const maxDuration = 60

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

// Claude API 호출 헬퍼 함수
async function callClaude(client: Anthropic, prompt: string, model = "claude-sonnet-4-5-20250929"): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== "text") {
    throw new Error("Claude API 응답 형식이 올바르지 않습니다.")
  }

  return content.text
}

// JSON 파싱 헬퍼 함수 (잘린 JSON 복구 시도)
function parseJsonResponse<T>(text: string): T {
  let jsonText = text.trim()

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

  // 먼저 정상 파싱 시도
  try {
    return JSON.parse(jsonText)
  } catch {
    // 잘린 JSON 복구 시도 (words 배열의 경우)
    // 마지막 완전한 문자열까지 찾아서 배열 닫기
    const lastCompleteQuote = jsonText.lastIndexOf('",')
    if (lastCompleteQuote > 0) {
      const repaired = jsonText.slice(0, lastCompleteQuote + 1) + "]}"
      try {
        return JSON.parse(repaired)
      } catch {
        // 복구 실패
      }
    }
    
    // 마지막 완전한 요소까지 찾기 (따옴표로 끝나는 경우)
    const lastQuote = jsonText.lastIndexOf('"')
    if (lastQuote > 0) {
      const repaired = jsonText.slice(0, lastQuote + 1) + "]}"
      try {
        return JSON.parse(repaired)
      } catch {
        // 복구 실패
      }
    }

    throw new Error("JSON 파싱 실패: 응답이 잘렸거나 형식이 올바르지 않습니다.")
  }
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

    const client = new Anthropic({ apiKey })

    // ========== 형태소 분석 프롬프트 ==========
    const morphemePrompt = `## 역할
다음 한국어 광고 텍스트에서 형태소 분석을 수행해주세요.

## 입력 텍스트
${textToAnalyze}

## 목표
1. 텍스트를 형태소로 분리합니다.
2. 다음 품사는 제외합니다: 조사(JKS, JKC, JKG, JKO, JKB, JKV, JKQ, JX, JC), 어미(EP, EF, EC, ETN, ETM), 접사, 부호, 기호, 숫자, 영문자 단독
3. 남은 형태소(명사, 동사 어간, 형용사 어간, 부사 등 의미있는 단어)를 모두 배열로 반환합니다.

## 제약사항
- 아래 JSON 구조를 엄격히 지키세요.
- 중복된 단어도 모두 포함하여 반환하세요.

## 출력 구조 (Strictly JSON)
{
  "words": ["단어1", "단어2", "단어1", "단어3", ...]
}
`

    // 형태소 분석 실행 (haiku 모델 사용)
    const morphemeResponse = await callClaude(client, morphemePrompt, "claude-haiku-4-5-20251001")
    const morphemeResult = parseJsonResponse<{ words: string[] }>(morphemeResponse)
    const words = morphemeResult.words || []

    // 빈도 카운트
    const frequencyMap = new Map<string, number>()
    for (const word of words) {
      frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1)
    }

    // 내림차순 정렬
    const morphemeCounts: MorphemeCount[] = Array.from(frequencyMap.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)

    // 결과 반환 (형태소 분석 결과만 반환, AI 인사이트는 별도 API로 분리)
    return NextResponse.json({
      morphemeCounts,
      totalWords: morphemeCounts.length,
    })
  } catch (error) {
    console.error("형태소 분석 오류:", error)
    return NextResponse.json(
      { error: "형태소 분석 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
