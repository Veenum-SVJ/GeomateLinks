import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, FileText, Briefcase, FolderKanban, Mails, Image, Settings, UserCircle } from 'lucide-react';
import { Logo } from '@/components/landing/logo';

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
        <Logo />
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className='ml-auto'>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <UserCircle className="h-5 w-5" />
                    <span className="sr-only">Toggle user menu</span>
                </Button>
            </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
