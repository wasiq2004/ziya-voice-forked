import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService, User } from '../services/authService';
import { getOrganizationLoginPath, getOrganizationSlugFromPath } from '../utils/tenant';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string, organizationSlug?: string | null) => Promise<any>;
  signUp: (email: string, username: string, password: string, organizationSlug?: string | null) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<any>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        // Check for Google Sign-In callback first (priority)
        const googleUser = await authService.handleGoogleSignInCallback();
        if (googleUser) {
          console.log('✅ Google OAuth user found:', googleUser.email);
          setUser(googleUser);
          localStorage.setItem('ziya-user', JSON.stringify(googleUser));
          // Remove URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          // Navigate to agents page
          navigate('/agents');
          return;
        }

        // Check if we have a valid session in localStorage
        const storedUser = localStorage.getItem('ziya-user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [location, navigate]); // Re-run when location changes

  useEffect(() => {
    const syncUserFromStorage = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail) {
        setUser(event.detail as User);
        return;
      }

      const storedUser = localStorage.getItem('ziya-user');
      setUser(storedUser ? JSON.parse(storedUser) : null);
    };

    window.addEventListener('ziya-user-updated', syncUserFromStorage as EventListener);
    window.addEventListener('storage', syncUserFromStorage);

    return () => {
      window.removeEventListener('ziya-user-updated', syncUserFromStorage as EventListener);
      window.removeEventListener('storage', syncUserFromStorage);
    };
  }, []);

  const signIn = async (email: string, password: string, organizationSlug?: string | null) => {
    try {
      const authenticatedUser = await authService.authenticateUser(email, password, organizationSlug);
      if (authenticatedUser) {
        setUser(authenticatedUser);
        // Store user in localStorage for session persistence
        localStorage.setItem('ziya-user', JSON.stringify(authenticatedUser));
        // Navigate based on role
        const role = authenticatedUser.role;
        if (role === 'super_admin') {
          navigate('/superadmin/dashboard');
        } else if (role === 'org_admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/agents');
        }
        return { data: { user: authenticatedUser }, error: null };
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Sign in failed' } };
    }
  };

  const signUp = async (email: string, username: string, password: string, organizationSlug?: string | null) => {
    try {
      const newUser = await authService.registerUser(email, username, password, organizationSlug);
      if (newUser) {
        setUser(newUser);
        // Store user in localStorage for session persistence
        localStorage.setItem('ziya-user', JSON.stringify(newUser));
        return { data: { user: newUser }, error: null };
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Sign up failed' } };
    }
  };

  const signInWithGoogle = async () => {
    try {
      await authService.signInWithGoogle();
    } catch (error) {
      console.error('Google Sign-In error:', error);
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
      // Clear user from localStorage
      localStorage.removeItem('ziya-user');
      // Navigate back to the matching login page after logout
      const currentOrgSlug = getOrganizationSlugFromPath(window.location.pathname);
      navigate(currentOrgSlug ? getOrganizationLoginPath(currentOrgSlug) : '/login');
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      if (!user?.id) throw new Error('No user logged in');
      const updatedUser = await authService.updateUserProfile(user.id, userData);
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('ziya-user', JSON.stringify(updatedUser));
        return { data: { user: updatedUser }, error: null };
      }
      throw new Error('Update failed');
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Update failed' } };
    }
  };

  const value = {
    user,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateUser,
    loading
  };

  // Don't render children while checking auth state,
  // but allow rendering on login page even if not authenticated
  if (loading && location.pathname !== '/login') {
    return (
      <div className="min-h-screen bg-lightbg dark:bg-darkbg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
