'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Admin' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/backlog', label: 'Backlog' },
  { href: '/admin/profile', label: 'Profile' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-48 bg-white border-r border-gray-200 min-h-screen flex-shrink-0">
      <div className="p-6 pt-8">
        <nav className="space-y-1">
          {navItems.map((item) => {
            let isActive = false;
            
            if (item.href === '/') {
              // Admin dashboard is active on / or /admin (except specific admin pages)
              isActive = pathname === '/' || pathname === '/admin' || 
                (pathname?.startsWith('/admin') && 
                 pathname !== '/admin/requests' && 
                 pathname !== '/admin/backlog' && 
                 pathname !== '/admin/profile' &&
                 pathname !== '/admin/dispatch');
            } else {
              isActive = pathname === item.href;
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block px-3 py-2 text-sm transition-colors cursor-pointer',
                  isActive
                    ? 'text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

