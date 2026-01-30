export const runtime = "nodejs"
export const maxDuration = 60

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { NaverAdData } from "@/types/naverAd"

interface MorphemeCount {
  word: string
  count: number
}

interface Prompt1Result {
  market_standard_formula: string
  extension_asset_landscape: string
  morpheme_intent_clustering: string[]
  message_saturation: string
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

// Claude API 호출 헬퍼 함수
async function callClaude(client: Anthropic, prompt: string, model = "claude-sonnet-4-5-20250929"): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
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

// JSON 파싱 헬퍼 함수
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

  return JSON.parse(jsonText)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ads = body.ads as NaverAdData[]
    const morphemeCounts = body.morphemeCounts as MorphemeCount[]

    if (!ads || ads.length === 0) {
      return NextResponse.json(
        { error: "광고 데이터가 없습니다." },
        { status: 400 }
      )
    }

    if (!morphemeCounts || morphemeCounts.length === 0) {
      return NextResponse.json(
        { error: "형태소 데이터가 없습니다." },
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

    // 형태소 raw 데이터 생성 (프롬프트1에 사용)
    const morphemeRaw = morphemeCounts
      .map((m) => `${m.word}: ${m.count}회`)
      .join("\n")

    // JSON 객체 문자열 (프롬프트1에 사용)
    const jsonDataString = JSON.stringify(ads, null, 2)

    // ========== 클로드 프롬프트1: 시장 분석 ==========
    const prompt1 = `## 역할
당신은 대규모 광고 데이터를 처리하는 검색광고 전략 분석가입니다. 개별 업체 분석이 아닌, 시장 전체의 소재 구성 문법과 형태소의 결합 패턴을 통계적으로 해석하여 시각화 가능한 데이터를 생성합니다.

## 목표
제공된 다수의 NaverAdData 배열과 morphemes 데이터를 통합 분석하여, 현재 시장을 지배하고 있는 소재 전략 지도를 JSON 형식으로 생성하세요.

## 분석 로직
1. market_standard_formula: 제목(title)과 설명(desc)에서 가장 빈번하게 발견되는 문장 구조 공식을 도출하세요. (예: 브랜드 + 신뢰 수치 + 혜택의 결합 비중 등)
2. extension_asset_landscape: assets 필드 데이터를 통합하여, 시장 내 확장 소재의 채택률과 가장 효과적으로 결합된 자산 세트를 정의하세요.
3. morpheme_intent_clustering: morphemes 빈도 데이터를 기반으로, 시장 내 주요 단어들을 의도(Intent) 그룹으로 클러스터링하세요. (예: 신뢰성 그룹, 가격/혜택 그룹, 액션 유도 그룹)
4. message_saturation: 현재 시장에서 과도하게 사용되어 피로도가 높은 메시지와 상대적으로 희소한 소구점을 대조 분석하세요.

## 제약사항
- 개별 광고주명은 언급하지 말고 시장 전체의 지배적인 흐름 관점에서 서술하세요.
- 마케터가 대시보드에서 시장 전체 현황을 한눈에 파악할 수 있는 아래 JSON 구조를 엄격히 지키세요.
- 프롬프트와 결과물에 별표 기호를 사용하지 마세요.

## 출력 구조 (Strictly JSON)
{
  "market_standard_formula": "주요 문구 구조 패턴 및 분포 분석 결과",
  "extension_asset_landscape": "표준 확장 소재 조합 및 자산 활용 현황",
  "morpheme_intent_clustering": ["그룹1(의도)", "그룹2(의도)", "그룹3(의도)"],
  "message_saturation": "메시지 포화도 상태 및 미개척 소구점 분석"
}

## 입력 데이터(수집 광고 소재)
${jsonDataString}

## 입력 데이터(광고 소재 형태소)
${morphemeRaw}`

    // 프롬프트1 실행
    const prompt1Response = await callClaude(client, prompt1)
    let prompt1Result: Prompt1Result
    try {
      prompt1Result = parseJsonResponse<Prompt1Result>(prompt1Response)
    } catch {
      console.error("프롬프트1 JSON 파싱 실패:", prompt1Response)
      prompt1Result = {
        market_standard_formula: "분석 결과 파싱에 실패했습니다.",
        extension_asset_landscape: "분석 결과 파싱에 실패했습니다.",
        morpheme_intent_clustering: [],
        message_saturation: "분석 결과 파싱에 실패했습니다.",
      }
    }

    // ========== 클로드 프롬프트2: 전략 인사이트 ==========
    const prompt2 = `## 역할
당신은 퍼포먼스 마케팅의 의사결정을 돕는 전략 컨설턴트입니다. 시장의 소재 트렌드와 형태소 데이터를 기반으로, 광고 효율을 극대화할 수 있는 단일 통합 전략을 수립합니다.

## 목표
광고 소재 분석 결과를 해석하여, 실무자가 즉시 적용할 수 있는 4대 전략 인사이트를 JSON 형식으로 생성하세요.

## 요구사항 (각 항목 100자 이상 필수)
1. market_winning_logic: 현재 시장에서 가장 높은 클릭률(CTR)을 유도할 수 있는 최적의 소재 공식을 형태소 조합 단위로 제안하세요. (예: 명사 + 수치 + 동사 조합의 유효성 등)
2. strategic_differentiation: 대다수 경쟁사가 선점하고 있는 언어 영역을 피하면서도, 사용자의 시선을 끌 수 있는 언어적 빈틈과 그에 맞는 소재 카피 전략을 기술하세요.
3. asset_optimization_plan: NaverAdData의 확장 소재 활용 현황을 바탕으로, 우리 광고의 점유 면적을 넓히고 전환율을 높이기 위한 최적의 자산 믹스 가이드를 제시하세요.
4. operational_roadmap: 위의 분석 결과를 바탕으로 실무에 즉시 적용할 수 있는 운영 로드맵을 제시하세요.

## 제약사항
- 반드시 100자 이상의 심층적인 분석 내용을 포함하세요.
- 전문 마케터의 실무 언어를 사용하며, 다른 설명 없이 오직 JSON 객체만 출력하세요.
- 구체적인 지표 예상 성과 수준을 언급하지 마십시오.

## 출력 구조 (Strictly JSON)
{
  "market_winning_logic": "...",
  "strategic_differentiation": "...",
  "asset_optimization_plan": [{"사이트링크":"..."}, {"홍보문구":"..."}, {"네이버 지도 태그":"..."}, {"네이버 지도 가격링크":"..."}, {"썸네일텍스트":"..."}],
  "operational_roadmap": "..."
}

## 입력 데이터(광고 소재 분석결과)
${JSON.stringify(prompt1Result, null, 2)}`

    // 프롬프트2 실행
    const prompt2Response = await callClaude(client, prompt2)
    let prompt2Result: Prompt2Result
    try {
      prompt2Result = parseJsonResponse<Prompt2Result>(prompt2Response)
    } catch {
      console.error("프롬프트2 JSON 파싱 실패:", prompt2Response)
      prompt2Result = {
        market_winning_logic: "전략 분석 결과 파싱에 실패했습니다.",
        strategic_differentiation: "전략 분석 결과 파싱에 실패했습니다.",
        asset_optimization_plan: [],
        operational_roadmap: "전략 분석 결과 파싱에 실패했습니다.",
      }
    }

    // 결과 반환
    return NextResponse.json({
      prompt1Result,
      prompt2Result,
    })
  } catch (error) {
    console.error("AI 인사이트 생성 오류:", error)
    return NextResponse.json(
      { error: "AI 인사이트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
