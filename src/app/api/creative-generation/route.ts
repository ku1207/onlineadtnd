export const runtime = "nodejs"
export const maxDuration = 60

import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

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

interface CreativeResult {
  ad_creatives: AdCreative[]
}

// Claude API 호출 헬퍼 함수
async function callClaude(client: Anthropic, prompt: string): Promise<string> {
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

  const content = response.content[0]
  if (content.type !== "text") {
    throw new Error("Claude API 응답 형식이 올바르지 않습니다.")
  }

  return content.text
}

// JSON 파싱 헬퍼 함수
function parseJsonResponse<T>(text: string): T {
  let jsonText = text.trim()

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
    const prompt2Result = body.prompt2Result

    if (!prompt2Result) {
      return NextResponse.json(
        { error: "전략 인사이트 데이터가 없습니다." },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const client = new Anthropic({ apiKey })

    const creativePrompt = `## 역할
당신은 네이버 검색광고 가이드라인과 최신 카피 트렌드에 정통한 전문 카피라이터입니다. 제공된 시장 분석 인사이트를 바탕으로 클릭률과 전환율이 극대화된 실무용 광고 소재 3세트를 생성합니다.

## 목적
전달받은 JSON 형태의 전략 인사이트를 실체화하여, 규격에 맞는 소재 3종을 JSON 형식으로 출력하세요.

## 검색광고 소재 필수 구성 요소
각 소재 세트는 아래 항목을 모두 포함해야 합니다.
1. adText_title: 1개 (띄어쓰기 포함 15자 이내)
2. adText_desc: 1개 (띄어쓰기 포함 45자 이내)
3. assets_promotionText: 1개 (띄어쓰기 포함 14자 이내)
4. assets_siteLink: 4개 배열 (각 항목 띄어쓰기 포함 6자에서 8자 이내)
5. thumbNailText: 3개 배열 (각 항목 띄어쓰기 포함 4자 이내)

## 검색광고 소재 준수 사항
- 특수문자는 가이드라인에 허용된 범위 내에서만 사용하세요. (예: !, ? 사용 지양, 문장 부호 남발 금지)
- 최상급 표현(최고, 제일, 1위 등)은 사용하지 마세요.
- 과대광고나 오해의 소지가 있는 자극적인 어휘는 배제하세요.
- 모든 글자 수는 네이버 광고 관리 시스템의 바이트(Byte)가 아닌 한국어 글자 수 제한을 엄격히 따릅니다.

## 소재 3종
- 소재 1 (Winning Logic): 시장의 표준 성공 공식을 충실히 따른 안정적 효율 소재
- 소재 2 (Differentiation): 경쟁사들이 놓치고 있는 빈틈을 공략하는 차별화 소재
- 소재 3 (Action Oriented): 즉각적인 혜택과 행동을 유도하는 중심 소재

## 제약사항
- 다른 설명 없이 오직 JSON 객체만 출력하세요.
- 프롬프트와 결과물에 별표 기호를 사용하지 마세요.
- 모든 소재는 전달받은 데이터의 맥락을 반드시 반영해야 합니다.

## 출력형태 (Strictly JSON)
{
  "ad_creatives": [
    {
      "version": "Winning Logic",
      "adText": {
        "title": "...",
        "desc": "..."
      },
      "assets": {
        "promotionText": "...",
        "siteLink": ["...", "...", "...", "..."],
        "thumbNailText": ["...", "...", "..."]
      }
    }
  ]
}

## 입력 데이터(전략 인사이트)
${JSON.stringify(prompt2Result, null, 2)}`

    const response = await callClaude(client, creativePrompt)
    let creativeResult: CreativeResult
    try {
      creativeResult = parseJsonResponse<CreativeResult>(response)
    } catch {
      console.error("소재 생성 JSON 파싱 실패:", response)
      return NextResponse.json(
        { error: "소재 생성 결과 파싱에 실패했습니다." },
        { status: 500 }
      )
    }

    return NextResponse.json(creativeResult)
  } catch (error) {
    console.error("소재 생성 오류:", error)
    return NextResponse.json(
      { error: "소재 생성 중 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
