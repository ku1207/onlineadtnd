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

// 슬라이더 네비게이션 경계 판별 (sitelinkText와 naverMapTag 구분용)
function isSliderNavigation(line: string): boolean {
  return line === "이전으로 이동" || line === "다음으로 이동"
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
  if (line === "내 업체 등록하기") return true
  if (hasAdRunMarker(line)) return true
  if (isAdRunLabelCandidate(line)) return true
  return false
}

// 방문자리뷰 패턴 인식 (예: "방문자리뷰 94")
function isVisitorReview(line: string): boolean {
  return /^방문자리뷰\s*\d+/.test(line)
}

// 네이버 지도 가격 링크 패턴 인식 (예: "기본 8,000원~", "변동가격(업주문의)원~")
function isNaverMapPriceLink(line: string): boolean {
  // 가격 정보: ~원, 원~, 숫자+원 패턴 포함
  return /원[~]?$/.test(line) || /\d+[,\d]*원/.test(line)
}

/**
 * HTML에서 각 광고 블록의 썸네일 이미지 URL을 추출한다.
 * div.ad_thumb 내부의 img.image 요소의 src 속성을 수집한다.
 * 반환: 광고 블록 순서대로 이미지 URL 배열의 배열
 */
export interface ThumbnailDebugInfo {
  totalImgTags: number
  adThumbDivs: number
  innerBlocks: number
  sampleImgs: { className: string; src: string; dataSrc: string }[]
  adThumbHtmlSamples: string[]
  extractedUrls: string[][]
}

/**
 * img 요소에서 이미지 URL을 추출한다.
 * src, data-src, data-lazy-src 순으로 시도한다.
 */
function getImgSrc(img: Element): string {
  return (
    img.getAttribute("src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-lazy-src") ||
    ""
  )
}

export function extractThumbnailImages(html: string): { thumbnails: string[][]; debug: ThumbnailDebugInfo } {
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // 디버그 정보 수집
  const allImgs = doc.querySelectorAll("img")
  const adThumbDivs = doc.querySelectorAll(".ad_thumb")
  const innerBlocks = doc.querySelectorAll(".inner")

  const sampleImgs: ThumbnailDebugInfo["sampleImgs"] = []
  allImgs.forEach((img, i) => {
    if (i < 30) {
      sampleImgs.push({
        className: img.className || "",
        src: (img.getAttribute("src") || "").slice(0, 150),
        dataSrc: (img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "").slice(0, 150),
      })
    }
  })

  const adThumbHtmlSamples: string[] = []
  adThumbDivs.forEach((div, i) => {
    if (i < 5) {
      adThumbHtmlSamples.push(div.innerHTML.slice(0, 500))
    }
  })

  const result: string[][] = []

  // 전략 1: .inner 블록 기반 추출
  if (innerBlocks.length > 0) {
    innerBlocks.forEach((block) => {
      const urls: string[] = []
      // .ad_thumb 내 img (class 무관)
      let imgs = block.querySelectorAll(".ad_thumb img")
      if (imgs.length === 0) {
        // fallback: ad_thumb 없을 수 있으니 다른 썸네일 컨테이너 시도
        imgs = block.querySelectorAll("[class*=thumb] img")
      }
      imgs.forEach((img) => {
        const src = getImgSrc(img)
        if (src) urls.push(src)
      })
      result.push(urls)
    })
  }

  // 전략 2: .inner가 없거나 결과가 모두 비어있으면 ad_thumb 직접 탐색
  const hasAnyUrl = result.some((urls) => urls.length > 0)
  if (!hasAnyUrl) {
    result.length = 0

    // ad_thumb 내의 모든 img를 수집
    const thumbImgs = doc.querySelectorAll(".ad_thumb img")
    if (thumbImgs.length > 0) {
      // ad_thumb 부모 단위로 그룹화
      const groups: Map<Element, string[]> = new Map()
      thumbImgs.forEach((img) => {
        const thumbParent = img.closest(".ad_thumb")
        if (!thumbParent) return
        // ad_thumb의 상위 광고 블록을 찾음
        const adBlock = thumbParent.parentElement?.closest("[class]") || thumbParent
        if (!groups.has(adBlock)) groups.set(adBlock, [])
        const src = getImgSrc(img)
        if (src) groups.get(adBlock)!.push(src)
      })
      groups.forEach((urls) => {
        result.push(urls)
      })
    }
  }

  // 전략 3: 그래도 없으면 class에 "image"가 포함된 img를 전체 탐색
  if (result.length === 0 || !result.some((urls) => urls.length > 0)) {
    result.length = 0
    const imageClassImgs = doc.querySelectorAll("img.image")
    if (imageClassImgs.length > 0) {
      const allUrls: string[] = []
      imageClassImgs.forEach((img) => {
        const src = getImgSrc(img)
        if (src) allUrls.push(src)
      })
      // 3개씩 그룹화 (네이버 썸네일 일반적 패턴)
      for (let i = 0; i < allUrls.length; i += 3) {
        result.push(allUrls.slice(i, i + 3))
      }
    }
  }

  const debug: ThumbnailDebugInfo = {
    totalImgTags: allImgs.length,
    adThumbDivs: adThumbDivs.length,
    innerBlocks: innerBlocks.length,
    sampleImgs,
    adThumbHtmlSamples,
    extractedUrls: result,
  }

  return { thumbnails: result, debug }
}

/**
 * 추출된 innerText를 파싱하여 NaverAdData 배열로 변환한다.
 *
 * 파싱 로직:
 * 1. URL(도메인) 패턴을 찾는다.
 * 2. URL 바로 윗줄 = brand.name (블록 시작)
 * 3. URL 다음줄이 "네이버페이" 관련이면 payments.naverpay 텍스트 추출
 * 4. 이후 순서대로: adText.title, adText.desc
 * 5. desc 다음줄이 7글자 이상이면 highlights
 * 6. "이전으로 이동" 전까지 sitelinkText 누적
 * 7. "이전으로 이동", "다음으로 이동" 건너뛰기
 * 8. "광고집행기간" 전까지 naverMapTag 누적
 * 9. naverMapTag 중 visitorReview, naverMapPriceLink 패턴 분리
 * 10. "광고집행기간" 다음줄 = adRunPeriod.label
 * 11. adRunPeriod.label 이후 thumbNailText 누적
 */
export function parseNaverAdText(
  rawText: string,
  keyword: string,
  thumbnailsByBlock?: string[][]
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

    // naverpay 판단: "네이버페이" 또는 "네이버 로그인" 텍스트 확인
    let naverpay: "Y" | "N" = "N"
    if (cursor < nextBlockStart) {
      const currentLine = lines[cursor]
      if (currentLine === "네이버페이" || currentLine.includes("네이버페이") || currentLine.includes("네이버 로그인")) {
        naverpay = "Y"
        cursor++
        // naverpay 다음 줄이 서비스 설명이면 건너뛰기
        if (cursor < nextBlockStart && lines[cursor].includes("서비스")) {
          cursor++
        }
      }
    }

    // adText.title
    const title = cursor < nextBlockStart ? lines[cursor++] : ""

    // adText.desc
    const desc = cursor < nextBlockStart ? lines[cursor++] : ""

    // promotionText (홍보문구): desc 다음 한 줄의 글자 수 확인 (7글자 이상)
    let promotionText = ""
    if (cursor < nextBlockStart && lines[cursor].length >= 7) {
      // 슬라이더 네비게이션이나 광고집행기간이 아닌 경우만
      if (!isSliderNavigation(lines[cursor]) &&
          !hasAdRunMarker(lines[cursor]) &&
          !isAdRunLabelCandidate(lines[cursor])) {
        promotionText = lines[cursor]
        cursor++
      }
    }

    // sitelinkText: "이전으로 이동" 또는 "광고집행기간" 전까지 누적
    // (visitorReview, naverMapPriceLink는 naverMapTag 섹션 이후에만 있으므로 여기서 체크하지 않음)
    const sitelinkText: string[] = []
    while (
      cursor < nextBlockStart &&
      !isSliderNavigation(lines[cursor]) &&
      !hasAdRunMarker(lines[cursor]) &&
      !isAdRunLabelCandidate(lines[cursor])
    ) {
      sitelinkText.push(lines[cursor])
      cursor++
    }

    // "이전으로 이동", "다음으로 이동" 건너뛰기
    while (cursor < nextBlockStart && isSliderNavigation(lines[cursor])) {
      cursor++
    }

    // naverMapTag: 광고집행기간 전까지 누적 (visitorReview, naverMapPriceLink 제외)
    const naverMapTag: string[] = []
    let visitorReview = ""
    let naverMapPriceLink = ""

    while (
      cursor < nextBlockStart &&
      !hasAdRunMarker(lines[cursor]) &&
      !isAdRunLabelCandidate(lines[cursor])
    ) {
      const currentLine = lines[cursor]

      if (isVisitorReview(currentLine)) {
        visitorReview = currentLine
      } else if (isNaverMapPriceLink(currentLine)) {
        naverMapPriceLink = currentLine
      } else if (!isSliderNavigation(currentLine)) {
        naverMapTag.push(currentLine)
      }
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

    // thumbNailText: adRunPeriod.label 이후 다음 블록 시작 전까지 누적
    const thumbNailText: string[] = []
    while (cursor < nextBlockStart) {
      const currentLine = lines[cursor]
      // 다음 브랜드명이 아닌 경우만 추가
      if (!isBrandBlocker(currentLine)) {
        thumbNailText.push(currentLine)
      }
      cursor++
    }

    // 필수값 검증: brand.domain, adText.title, adText.desc, adRunPeriod.label
    // 모든 필수값이 있어야 완전한 광고 객체로 인정
    if (brandDomain && title && desc && adRunPeriodLabel) {
      // 썸네일 이미지: blockIdx에 해당하는 이미지 배열 할당
      const thumbNailImages = thumbnailsByBlock && thumbnailsByBlock[blockIdx]
        ? thumbnailsByBlock[blockIdx]
        : []

      results.push({
        keyword,
        rank: blockIdx + 1,
        brand: { name: brandName, domain: brandDomain },
        payments: { naverpay },
        adText: { title, desc },
        assets: {
          promotionText,
          sitelinkText,
          naverMapTag,
          visitorReview,
          naverMapPriceLink,
          thumbNailText,
          thumbNailImages,
        },
        meta: { adRunPeriod: { label: adRunPeriodLabel } },
      })
    }
  }

  // rank 재정렬 (불완전한 객체가 필터링되어 순번이 맞지 않을 수 있음)
  results.forEach((item, idx) => {
    item.rank = idx + 1
  })

  return results
}
