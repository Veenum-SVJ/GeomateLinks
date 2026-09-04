import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

type PageConfig = {
  title: string
  description: string
  keywords: string
  type: string
  url: string
}

const pageConfig: Record<string, PageConfig> = {
  '/': {
    title: 'GeoLink Navigator | Geomate Links Consulting Limited',
    description: 'Innovative Surveying, Mapping & GIS Solutions in Nigeria. Geomate Links Consulting Limited is a leading firm in surveying, mapping, and GIS consultancy.',
    keywords: 'Surveying Nigeria, Mapping Services, GIS, LIS, Geomate Links, Ibadan',
    type: 'website',
    url: 'https://geomate-links.vercel.app/',
  },
  '/login': {
    title: 'Admin Login | Geomate Links Consulting',
    description: 'Admin login portal for Geomate Links Consulting Limited. Access your dashboard for project management and client services.',
    keywords: 'Admin Login, Geomate Links, Dashboard',
    type: 'website',
    url: 'https://geomate-links.vercel.app/login',
  },
  '/dashboard': {
    title: 'Dashboard | Geomate Links Consulting',
    description: 'Admin dashboard for managing Geomate Links website content, projects, services, and media.',
    keywords: 'Admin, Dashboard, Geomate Links',
    type: 'website',
    url: 'https://geomate-links.vercel.app/dashboard',
  },
}

export default function useSEO() {
  const location = useLocation()
  
  useEffect(() => {
    const path = location.pathname || '/'
    const config = pageConfig[path] || pageConfig['/']
    
    // Update title
    document.title = config.title
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.setAttribute('name', 'description')
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', config.description)
    
    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]')
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta')
      metaKeywords.setAttribute('name', 'keywords')
      document.head.appendChild(metaKeywords)
    }
    metaKeywords.setAttribute('content', config.keywords)
    
    // Update canonical
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', config.url)
    
    // Update Open Graph tags
    const ogTags = [
      { property: 'og:title', content: config.title },
      { property: 'og:description', content: config.description },
      { property: 'og:type', content: config.type },
      { property: 'og:url', content: config.url },
      { property: 'og:image', content: `${config.url}og-image.jpg` },
      { property: 'og:site_name', content: 'Geomate Links Consulting Limited' },
      { property: 'og:locale', content: 'en_NG' },
    ]
    
    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    })
    
    // Update Twitter Card tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: config.title },
      { name: 'twitter:description', content: config.description },
      { name: 'twitter:image', content: `${config.url}og-image.jpg` },
    ]
    
    twitterTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', name)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    })
  }, [location.pathname])
}
