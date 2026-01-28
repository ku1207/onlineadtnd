import { JSDOM } from "jsdom"
import { NaverAdData } from "@/types/naverAd"

// ── 블록 레벨 요소 목록 (HTML 기본 display:block) ──
const BLOCK_ELEMENTS = new Set([
  "address", "article", "aside", "blockquote", "center",
  "details", "dialog", "dd", "dir", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hgroup", "hr", "li", "main", "menu",
  "nav", "ol", "p", "pre", "section", "summary",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr",
  "ul",
])

// 블록 경계를 나타내는 센티넬 문자 (후처리에서 단일 개행으로 변환)
const BLK = "\x00"

/**
 * 블록 컨테이너가 텍스트 노드 없이 자식 요소만(2개 이상) 갖는지 판별.
 * true이면 각 자식을 블록으로 승격시켜 줄바꿈을 삽입한다.
 * (CSS display:block이 적용된 인라인 요소를 보정하는 휴리스틱)
 */
function hasOnlyElementChildren(node: Node): boolean {
  let elementCount = 0
  const children = node.childNodes
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.nodeType === 1 /* ELEMENT_NODE */) {
      elementCount++
      continue
    }
    if (child.nodeType === 3 /* TEXT_NODE */) {
      if ((child.textContent ?? "").trim() !== "") return false
    }
  }
  return elementCount >= 2
}

/**
 * DOM 트리를 재귀 탐색하여 브라우저 innerText에 가까운 텍스트를 추출한다.
 * JSDOM은 innerText를 지원하지 않으므로(undefined 반환) 직접 구현한다.
 *
 * - 블록 요소: 전후에 BLK 마커를 삽입 (후처리에서 단일 개행으로 치환)
 * - 인라인 요소: 텍스트를 이어 붙임
 * - 블록 컨테이너의 자식이 모두 요소(2개 이상)이면 각 자식도 블록으로 취급
 */
function walkNode(node: Node, parentForcesBlock = false): string {
  // 텍스트 노드
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return (node.textContent ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/ {2,}/g, " ")
  }

  // 요소 노드
  if (node.nodeType === 1 /* ELEMENT_NODE */) {
    const el = node as Element
    const tagName = (el.tagName ?? "").toLowerCase()

    // 비표시 요소 제거
    if (tagName === "script" || tagName === "style" || tagName === "noscript") {
      return ""
    }
    if (tagName === "br") return "\n"
    if (tagName === "hr") return "\n"

    const isBlock = BLOCK_ELEMENTS.has(tagName)
    const treatAsBlock = isBlock || parentForcesBlock
    const forceChildBlock = isBlock && hasOnlyElementChildren(node)

    let childText = ""
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      childText += walkNode(children[i], forceChildBlock)
    }

    if (treatAsBlock) {
      return BLK + childText + BLK
    }
    return childText
  }

  return ""
}

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
 * HTML에서 브라우저 개발자도구의 innerText와 동일한 텍스트를 추출한다.
 *
 * JSDOM은 innerText를 구현하지 않아 undefined를 반환하므로,
 * DOM 트리를 직접 탐색하여 블록 요소 경계에 줄바꿈을 삽입한다.
 * 블록 컨테이너의 자식이 모두 요소인 경우 각 자식도 블록으로 승격시켜
 * CSS display:block이 적용된 인라인 요소(<a>, <span> 등)도 올바르게 처리한다.
 */
export function extractInnerText(html: string): string {
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // DOM 워커로 텍스트 추출
  const rawText = walkNode(doc.body ?? doc.documentElement)

  // 블록 경계 마커(BLK)를 단일 개행으로 변환 + 정규화
  let text = rawText
    .replace(/\x00+/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")

  // URL/도메인과 광고집행기간 라벨이 인라인으로 붙어있는 경우 줄바꿈 삽입
  text = insertNewlinesAroundUrls(text)
  text = breakTrailingAfterUrl(text)
  text = breakAfterAdRunLabel(text)
  text = removeBlankLines(text)

  return text
}

// DOM 워커로 추출한 텍스트를 줄바꿈/nbsp만 정규화하여 반환
export function getOuterTextRaw(html: string): string {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const rawText = walkNode(doc.body ?? doc.documentElement)
  return rawText
    .replace(/\x00+/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
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

function hasAdRunMarker(line: string): boolean {
  return line.includes("광고집행기간")
}

// 브랜드명을 막는 제어 토큰
function isBrandBlocker(line: string): boolean {
  if (line === "네이버페이") return true
  if (hasAdRunMarker(line)) return true
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
 * 8. 이후 다음 블록 시작 전까지 naverMapTag 누적 (네이버 지도 태그)
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
      !hasAdRunMarker(lines[cursor]) &&
      !isAdRunLabelCandidate(lines[cursor])
    ) {
      sitelinkText.push(lines[cursor])
      cursor++
    }

    // adRunPeriod
    let adRunPeriodLabel = ""
    if (cursor < nextBlockStart && hasAdRunMarker(lines[cursor])) {
      // 라벨이 같은 줄에 붙어 있을 수 있음
      const current = lines[cursor]
      const inlineLabel = normalizeAdRunLabel(current)
      if (inlineLabel) {
        adRunPeriodLabel = inlineLabel
        cursor++
      } else {
        cursor++ // "광고집행기간" 건너뛰기
        if (cursor < nextBlockStart) {
          adRunPeriodLabel = normalizeAdRunLabel(lines[cursor])
          cursor++
        }
      }
    } else if (cursor < nextBlockStart && isAdRunLabelCandidate(lines[cursor])) {
      // "광고집행기간" 키워드가 없더라도 라벨 패턴을 만나면 바로 채택
      adRunPeriodLabel = normalizeAdRunLabel(lines[cursor])
      cursor++
    }

    // naverMapTag: 광고집행기간 이후 다음 블록 시작 전까지 누적 (네이버 지도 태그)
    const naverMapTag: string[] = []
    while (cursor < nextBlockStart) {
      naverMapTag.push(lines[cursor])
      cursor++
    }

    results.push({
      keyword,
      rank: blockIdx + 1,
      brand: { name: brandName, domain: brandDomain },
      payments: { naverpay },
      adText: { title, desc },
      assets: { highlights, sitelinkText, naverMapTag },
      meta: { adRunPeriod: { label: adRunPeriodLabel } },
    })
  }

  return results
}
