import AuthenticatedLayoutClient from './layout-client';

export { useSidebar } from './layout-client';

export const dynamic = 'force-dynamic';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthenticatedLayoutClient>
      {children}
    </AuthenticatedLayoutClient>
  );
}
