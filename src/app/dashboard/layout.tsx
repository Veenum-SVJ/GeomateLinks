import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, FileText, Briefcase, FolderKanban, Mails, Image, Settings, UserCircle } from 'lucide-react';

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Pages', href: '#', icon: FileText },
    { name: 'Services', href: '#', icon: Briefcase },
    { name: 'Projects', href: '#', icon: FolderKanban },
    { name: 'Messages', href: '#', icon: Mails },
    { name: 'Media', href: '#', icon: Image },
    { name: 'Settings', href: '#', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary h-6 w-6">
                <path d="M21.5 12C21.5 17.799 16.799 22.5 11 22.5C5.20101 22.5 0.5 17.799 0.5 12C0.5 6.20101 5.20101 1.5 11 1.5C16.799 1.5 21.5 6.20101 21.5 12Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 1.5V22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22.5 12H1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 1.5C13.5011 4.31667 15.1678 7.83333 15.5 12C15.1678 16.1667 13.5011 19.6833 11 22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 1.5C8.49893 4.31667 6.83223 7.83333 6.5 12C6.83223 16.1667 8.49893 19.6833 11 22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="sr-only">Geomate Links</span>
          </Link>
          {navItems.map((item) => (
            <Link
                key={item.name}
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
            >
                {item.name}
            </Link>
          ))}
        </nav>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className="ml-auto flex-1 sm:flex-initial">
                 <h1 className="text-xl font-semibold">CMS Dashboard</h1>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
                <UserCircle className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
            </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
