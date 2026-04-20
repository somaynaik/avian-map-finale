import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Debug component to show current auth state
 * Remove this in production or hide behind a feature flag
 */
export const AuthDebug = () => {
  const { user, loading } = useAuth();

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <Card className="fixed bottom-4 right-4 w-80 opacity-90 z-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Auth Debug</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <span className="font-semibold">Status:</span>{' '}
          {loading ? '⏳ Loading...' : user ? '✅ Authenticated' : '❌ Not authenticated'}
        </div>
        {user && (
          <>
            <div>
              <span className="font-semibold">Email:</span> {user.email}
            </div>
            <div>
              <span className="font-semibold">Username:</span>{' '}
              {user.user_metadata?.username || 'Not set'}
            </div>
            <div>
              <span className="font-semibold">ID:</span>{' '}
              <code className="text-[10px]">{user.id.slice(0, 20)}...</code>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
