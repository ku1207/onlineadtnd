export interface NaverAdData {
  keyword: string
  rank: number
  brand: {
    name: string
    domain: string
  }
  payments: {
    naverpay: "Y" | "N"
  }
  adText: {
    title: string
    desc: string
  }
  assets: {
    highlights: string
    sitelinkText: string[]
    naverMapTag: string[]
    visitorReview: string
    naverMapPriceLink: string
    thumbNailText: string[]
  }
  meta: {
    adRunPeriod: { label: string }
  }
}
