'use client';

/**
 * Verify Layout - Persistent wrapper with header that stays mounted during navigation
 * The header lives here so it NEVER remounts when navigating between pages
 */
import { ReactNode } from 'react';
import { VerifyProvider } from '@/context/VerifyContext';
import VerifyHeader from '@/components/VerifyHeader';

export default function VerifyLayout({ children }: { children: ReactNode }) {
    return (
        <VerifyProvider>
            <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
                {/* Header - always mounted, never reloads */}
                <VerifyHeader />
                {/* Page content - only this part changes on navigation */}
                {children}
            </div>
        </VerifyProvider>
    );
}
