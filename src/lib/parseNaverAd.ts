import { JSDOM } from "jsdom"
import { NaverAdData } from "@/types/naverAd"

// 줄 내 공백 뒤에 오는 URL/도메인 패턴을 새 줄로 내려준다 (한글 도메인 포함)
function insertNewlinesAroundUrls(text: string): string {
  return text.replace(
    /(^|[^\n])\s*((?:https?:\/\/)?[\p{L}\p{N}][\p{L}\p{N}._-]*\.[\p{L}\p{N}.-]{2,}(?:\/\S*)?)/gu,
    (_match, prev, url) => `${prev}\n${url}`
  )
}

// URL 바로 뒤에 붙은 텍스트가 있으면 URL 뒤에 줄바꿈을 추가해 분리한다
function breakTrailingAfterUrl(text: string): string {
  return text.replace(
    /((?:https?:\/\/)?[\p{L}\p{N}][\p{L}\p{N}._-]*\.[\p{L}\p{N}.-]{2,}(?:\/\S*)?)(\s+)(\S)/gu,
    (_m, url, _sp, next) => `${url}\n${next}`
  )
}

// "광고집행기간" 뒤에 붙은 기간 정보를 줄바꿈으로 분리한다
function breakAfterAdRunLabel(text: string): string {
  return text.replace(/(광고집행기간)(\s*)(\S)/g, (_m, label, _sp, next) => `${label}\n${next}`)
}

// 완전히 공백인 줄 제거 + 과도한 개행 축소
function removeBlankLines(text: string): string {
  return text
    .replace(/^\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
}

/**
 * HTML에서 브라우저 개발자도구 Properties 탭의 innerText와 동일한 텍스트를 추출한다.
 * jsdom으로 DOM을 만든 뒤 실제 body.innerText를 사용해 줄바꿈과 공백을 그대로 보존한다.
 */
export function extractInnerText(html: string): string {
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // 화면에 노출되지 않는 콘텐츠 제거 후 실제 innerText 사용 (DevTools layout에 가까움)
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove())

  const rawLayoutText = doc.body?.innerText ?? ""
  const normalizedLayout = rawLayoutText
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")

  const withUrlBreaks = insertNewlinesAroundUrls(normalizedLayout)
  const withSeparatedUrlTrailing = breakTrailingAfterUrl(withUrlBreaks)
  const withAdRunBreaks = breakAfterAdRunLabel(withSeparatedUrlTrailing)
  const cleanedLayout = removeBlankLines(withAdRunBreaks)

  if (cleanedLayout.length > 0) return cleanedLayout

  // Fallback: outerText 기반 정리
  const rawOuterText = (doc.body as any)?.outerText ?? doc.body?.textContent ?? ""
  const normalizedOuterText = rawOuterText
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")

  const adRunSeparated = normalizedOuterText.replace(/광고집행기간/g, "\n광고집행기간\n")
  const spacedToNewlines = adRunSeparated.replace(/[ \t]{2,}/g, "\n")
  const withoutTemplate = spacedToNewlines.split("window.__ADFE_TEMPLATE__")[0]

  const withUrlBreaksFallback = insertNewlinesAroundUrls(withoutTemplate)
  const withSeparatedUrlTrailingFallback = breakTrailingAfterUrl(withUrlBreaksFallback)
  const withAdRunBreaksFallback = breakAfterAdRunLabel(withSeparatedUrlTrailingFallback)
  const cleanedOuterText = removeBlankLines(withAdRunBreaksFallback)

  if (cleanedOuterText.length > 0) return cleanedOuterText

  // Fallback: static stripping when DOM innerText is empty (e.g., content rendered via JS/iframes)
  let text = html

  // script, style, noscript 콘텐츠 제거
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")

  // 블록 요소 닫는 태그를 줄바꿈으로 변환 (인라인 요소는 제외)
  text = text.replace(
    /<\/(div|p|li|h[1-6]|tr|td|th|section|article|header|footer|nav|ul|ol|dl|dt|dd|blockquote|pre|figure|figcaption|main|aside)[^>]*>/gi,
    "\n"
  )
  text = text.replace(/<br\s*\/?\>/gi, "\n")
  text = text.replace(/<hr\s*\/?\>/gi, "\n")

  // 남은 태그 제거
  text = text.replace(/<[^>]+>/g, "")

  // HTML 엔티티 디코딩
  text = text.replace(/&amp;/g, "&")
  text = text.replace(/&lt;/g, "<")
  text = text.replace(/&gt;/g, ">")
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, " ")
  text = text.replace(/&#\d+;/g, "")

  // 공백 정리
  text = text.replace(/[ \t]+/g, " ")
  text = text.replace(/\n[ \t]+/g, "\n")
  text = text.replace(/[ \t]+\n/g, "\n")

  const fallbackWithUrlBreaks = insertNewlinesAroundUrls(text.trim())
  const fallbackWithSeparatedUrlTrailing = breakTrailingAfterUrl(fallbackWithUrlBreaks)
  const fallbackWithAdRunBreaks = breakAfterAdRunLabel(fallbackWithSeparatedUrlTrailing)
  const cleanedFallback = removeBlankLines(fallbackWithAdRunBreaks)
  return cleanedFallback
}

// DevTools Properties "Copy string contents" 값 그대로(개행/nbsp만 정규화) 반환용
export function getOuterTextRaw(html: string): string {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const rawOuterText = (doc.body as any)?.outerText ?? doc.body?.textContent ?? ""
  return rawOuterText.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ")
}

/**
 * URL(도메인) 패턴인지 판별한다.
 */
function isUrlLine(line: string): boolean {
  // Allow Korean/Unicode domains as well as ASCII; optional protocol; simple path tail.
  return /^(?:https?:\/\/)?[\p{L}\p{N}][\p{L}\p{N}._-]*\.[\p{L}\p{N}.-]{2,}(?:\/\S*)?$/u.test(line)
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

// 광고 집행 기간 라벨 후보 (개월, 개월 이상 등)
function isAdRunLabelCandidate(line: string): boolean {
  return /\d+\s*개월(?:\s*이상)?/.test(line)
}

function normalizeAdRunLabel(line: string): string {
  return line.replace(/광고집행기간\s*/g, "").trim()
}

// 브랜드명을 막는 제어 토큰
function isBrandBlocker(line: string): boolean {
  if (line === "네이버페이") return true
  if (line === "광고집행기간") return true
  if (isAdRunLabelCandidate(line)) return true
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

    // brand (optional): skip if preceding line is control token like 네이버페이/광고집행기간
    let brandName = ""
    if (urlIdx > 0) {
      const candidate = lines[urlIdx - 1]
      if (!isBrandBlocker(candidate)) {
        brandName = candidate
      }
    }
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
    while (
      cursor < nextBlockStart &&
      lines[cursor] !== "광고집행기간" &&
      !isAdRunLabelCandidate(lines[cursor])
    ) {
      sitelinkText.push(lines[cursor])
      cursor++
    }

    // adRunPeriod
    let adRunPeriodLabel = ""
    if (cursor < nextBlockStart && lines[cursor] === "광고집행기간") {
      cursor++ // "광고집행기간" 건너뛰기
      if (cursor < nextBlockStart) {
        adRunPeriodLabel = normalizeAdRunLabel(lines[cursor])
        cursor++
      }
    } else if (cursor < nextBlockStart && isAdRunLabelCandidate(lines[cursor])) {
      // "광고집행기간" 키워드가 없더라도 라벨 패턴을 만나면 바로 채택
      adRunPeriodLabel = normalizeAdRunLabel(lines[cursor])
      cursor++
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
