export type Address = {
  suite: string
  street: string
  city: string
  state: string
  country: string
  postal: string
}

export type Company = {
  name: string
  shortName: string
  discipline: string
  established: string
  rcNumber: string
  registrar: string
  mission: string
  corporateInfo: string
  legalStructure: string
  humanResources: string
  address: Address
  phones: string[]
  emails: string[]
  website: string
  facebook: string
  hours: string
  coordinates: { lat: number; lon: number }
  mapEmbed: string
  mapLink: string
}

export type Hero = {
  tag: string
  headlineTop: string
  headlineAccent: string
  headlineBottom: string
  intro: string
  primaryCta: string
  secondaryCta: string
  videoCaption: string
  videoCoords: string
  videoUrl?: string
  posterUrl?: string
}

export type Stat = { value: string; label: string }

export type Service = {
  id: string
  num: string
  title: string
  blurb: string
  items: string[]
}

export type Project = {
  id: string
  title: string
  category: string
  location: string
  status: string
  image: string
  thumb?: string
  alt: string
}

export type PageCopy = { label: string; title: string; body: string }

export type SiteContent = {
  company: Company
  hero: Hero
  stats: Stat[]
  services: Service[]
  projects: Project[]
  aboutImages?: string[]
  equipment: { field: string[]; hardware: string[]; software: string[] }
  team: { name: string; role: string; note: string }[]
  credentials: string[]
  pages: {
    about: PageCopy
    services: PageCopy
    projects: PageCopy
    contact: PageCopy
  }
}

export type StoredMessage = {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  createdAt: string
  read: boolean
}

export type MediaItem = {
  pathname: string
  url: string
  size: number
  uploadedAt: string
}
