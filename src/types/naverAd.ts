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
    promotionText: string
    sitelinkText: string[]
    naverMapTag: string[]
    visitorReview: string
    naverMapPriceLink: string
    thumbNailText: string[]
    thumbNailImages: string[]
  }
  meta: {
    adRunPeriod: { label: string }
  }
}
