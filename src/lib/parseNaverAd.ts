import { JSDOM } from "jsdom"
import { NaverAdData } from "@/types/naverAd"

/**
 * HTML 문자열에서 브라우저 개발자도구 Properties 탭의 innerText와
 * 동일한 텍스트를 추출한다.
 * jsdom을 사용하여 실제 DOM을 구성한 뒤 element.innerText를 호출한다.
 */
export function extractInnerText(html: string): string {
  const dom = new JSDOM(html)
  const document = dom.window.document

  // script, style, noscript 요소 제거 (보이지 않는 콘텐츠)
  document
    .querySelectorAll("script, style, noscript")
    .forEach((el) => el.remove())

  const text = document.body?.innerText ?? document.body?.textContent ?? ""
  dom.window.close()
  return text.trim()
}

/**
 * URL(도메인) 패턴인지 판별한다.
 */
function isUrlLine(line: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}(\/\S*)?$/.test(line)
}

/**
 * 제외 대상인지 판별한다.
 * - 단독 숫자(페이지 번호)
 * - "다음페이지" 텍스트
 */
function isExcludedLine(line: string): boolean {
  if (/^\d+$/.test(line)) return true
  if (line === "다음페이지") return true
  return false
}

/**
 * 추출된 innerText를 파싱하여 NaverAdData 배열로 변환한다.
 *
 * 파싱 로직:
 * 1. URL(도메인) 패턴을 찾는다.
 * 2. URL 바로 윗줄 = brand.name (블록 시작)
 * 3. URL 다음줄이 "네이버페이"이면 naverpay = "Y", 아니면 "N"
 * 4. 이후 순서대로: adText.title, adText.desc
 * 5. desc 다음줄이 7글자 이상이면 highlights, 미만이면 sitelinkText로
 * 6. "광고집행기간" 전까지 sitelinkText 누적
 * 7. "광고집행기간" 다음줄 = adRunPeriod.label
 * 8. 이후 다음 블록 시작 전까지 thumbnailText 누적
 */
export function parseNaverAdText(
  rawText: string,
  keyword: string
): NaverAdData[] {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .filter((l) => !isExcludedLine(l))

  // URL이 위치한 인덱스를 모두 찾는다
  const urlIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isUrlLine(lines[i])) {
      urlIndices.push(i)
    }
  }

  const results: NaverAdData[] = []

  for (let blockIdx = 0; blockIdx < urlIndices.length; blockIdx++) {
    const urlIdx = urlIndices[blockIdx]

    // 다음 블록의 brand.name 위치 (다음 URL - 1) 또는 전체 끝
    const nextBlockStart =
      blockIdx + 1 < urlIndices.length
        ? urlIndices[blockIdx + 1] - 1
        : lines.length

    // brand
    const brandName = urlIdx > 0 ? lines[urlIdx - 1] : ""
    const brandDomain = lines[urlIdx]

    let cursor = urlIdx + 1

    // naverpay 판단
    let naverpay: "Y" | "N" = "N"
    if (cursor < nextBlockStart && lines[cursor] === "네이버페이") {
      naverpay = "Y"
      cursor++
    }

    // adText.title
    const title = cursor < nextBlockStart ? lines[cursor++] : ""

    // adText.desc
    const desc = cursor < nextBlockStart ? lines[cursor++] : ""

    // highlights: desc 다음 한 줄의 글자 수 확인
    let highlights = ""
    if (cursor < nextBlockStart && lines[cursor].length >= 7) {
      highlights = lines[cursor]
      cursor++
    }

    // sitelinkText: "광고집행기간" 전까지 누적
    const sitelinkText: string[] = []
    while (cursor < nextBlockStart && lines[cursor] !== "광고집행기간") {
      sitelinkText.push(lines[cursor])
      cursor++
    }

    // adRunPeriod
    let adRunPeriodLabel = ""
    if (cursor < nextBlockStart && lines[cursor] === "광고집행기간") {
      cursor++ // "광고집행기간" 건너뛰기
      if (cursor < nextBlockStart) {
        adRunPeriodLabel = lines[cursor]
        cursor++
      }
    }

    // thumbnailText: 다음 블록 시작 전까지 누적
    const thumbnailText: string[] = []
    while (cursor < nextBlockStart) {
      thumbnailText.push(lines[cursor])
      cursor++
    }

    results.push({
      keyword,
      rank: blockIdx + 1,
      brand: { name: brandName, domain: brandDomain },
      payments: { naverpay },
      adText: { title, desc },
      assets: { highlights, sitelinkText, thumbnailText },
      meta: { adRunPeriod: { label: adRunPeriodLabel } },
    })
  }

  return results
}
