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
  }
  meta: {
    adRunPeriod: { label: string }
  }
}
