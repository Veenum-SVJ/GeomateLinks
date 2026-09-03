import { ChevronRight } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

interface BreadcrumbItem {
  title: string
  href: string
}

export function Breadcrumb() {
  const location = useLocation()
  
  const breadcrumbs: BreadcrumbItem[] = [
    { title: "Home", href: "/" }
  ]
  
  // Add current page to breadcrumbs
  const pathnames = location.pathname.split('/').filter((x) => x)
  let currentPath = ''
  
  pathnames.forEach((name) => {
    currentPath += `/${name}`
    breadcrumbs.push({
      title: name.charAt(0).toUpperCase() + name.slice(1),
      href: currentPath
    })
  })
  
  return (
    <nav aria-label="Breadcrumb" className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />}
            {index === breadcrumbs.length - 1 ? (
              <span className="text-muted-foreground" aria-current="page">{item.title}</span>
            ) : (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {item.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
