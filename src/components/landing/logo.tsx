import { cn } from "@/lib/utils";
import Link from 'next/link';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm", className)}>
      <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
            <path d="M21.5 12C21.5 17.799 16.799 22.5 11 22.5C5.20101 22.5 0.5 17.799 0.5 12C0.5 6.20101 5.20101 1.5 11 1.5C16.799 1.5 21.5 6.20101 21.5 12Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 1.5V22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22.5 12H1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 1.5C13.5011 4.31667 15.1678 7.83333 15.5 12C15.1678 16.1667 13.5011 19.6833 11 22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 1.5C8.49893 4.31667 6.83223 7.83333 6.5 12C6.83223 16.1667 8.49893 19.6833 11 22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight text-primary">
        Geomate Links Consulting Limited
      </span>
    </Link>
  );
}
