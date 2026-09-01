# Geomate Links Consulting Limited

Professional Surveying, Mapping & GIS Solutions in Nigeria.

## Technology Stack

- **Frontend:** Vite 5 + React 18 + TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **UI Components:** shadcn/ui primitives
- **Forms:** React Hook Form + Zod validation
- **Routing:** React Router DOM
- **Serverless Functions:** Vercel Node runtime for file uploads

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
vite-app/
├── api/upload/           # Vercel serverless upload function
├── public/images/        # Static assets (images, videos)
├── src/
│   ├── components/
│   │   ├── landing/      # Landing page components
│   │   └── ui/           # shadcn/ui primitives
│   ├── pages/            # Route pages
│   ├── lib/utils.ts      # Utility functions
│   └── main.tsx          # Entry point
├── vercel.json           # Vercel deployment config
├── vite.config.ts        # Vite configuration
└── tailwind.config.js    # Tailwind configuration
```

## Deployment

Deploy to Vercel automatically from GitHub:

1. Connect your GitHub repository to Vercel
2. Select the `feat/vite-migration` branch (or merge to main)
3. Vercel will auto-detect the build settings
4. No additional configuration needed

## Features

- Responsive landing page with hero, about, services, projects, and contact sections
- Image gallery with category filtering (Cadastral, GIS, Drone Mapping, Digitization)
- Contact form with validation
- Admin login page (placeholder)
- Serverless file upload API at `/api/upload`

## License

Private project for Geomate Links Consulting Limited
