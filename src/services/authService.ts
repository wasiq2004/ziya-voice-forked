import { getApiBaseUrl, getApiPath } from '../utils/api';

export interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  profile_image?: string;
  dob?: string;
  gender?: string;
  google_id?: string;
  current_company_id?: string;
  role?: string;
  organization_id?: number | null;
  organization_name?: string | null;
  organization_slug?: string | null;
  organization_logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
  // Trial & Plan fields
  plan_type?: 'trial' | 'paid' | 'enterprise' | null;
  plan_valid_until?: string | null;
  trial_started_at?: string | null;
}

export interface Profile {
  id: string;
  updated_at: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface AuthErrorData {
  message: string;
  passwordResetInitiated?: boolean;
  passwordResetRequiresWait?: boolean;
  email?: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  email?: string;
}

export const authService = {
  // Authenticate user with email and password
  async authenticateUser(email: string, password: string, organizationSlug?: string | null): Promise<User | null> {
    try {
      const path = organizationSlug ? `/auth/${encodeURIComponent(organizationSlug)}/login` : '/auth/login';
      const response = await fetch(`${getApiBaseUrl()}${getApiPath()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!result.success) {
        const authError = new Error(result.message || 'Invalid credentials') as Error & { data?: AuthErrorData };
        authError.data = {
          message: result.message || 'Invalid credentials',
          passwordResetInitiated: result.passwordResetInitiated,
          passwordResetRequiresWait: result.passwordResetRequiresWait,
          email: result.email
        };
        throw authError;
      }

      return result.user;
    } catch (error: any) {
      console.error('Authentication error:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  },

  // Register a new user
  async registerUser(email: string, username: string, password: string, organizationSlug?: string | null): Promise<User | null> {
    try {
      const path = organizationSlug ? `/auth/${encodeURIComponent(organizationSlug)}/signup` : '/auth/signup';
      const response = await fetch(`${getApiBaseUrl()}${getApiPath()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Registration failed');
      }

      return result.user;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    }
  },

  async requestPasswordReset(email: string): Promise<PasswordResetResponse> {
    const response = await fetch(`${getApiBaseUrl()}${getApiPath()}/auth/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to send password reset OTP');
    }

    return result;
  },

  async verifyPasswordResetOtp(email: string, otp: string): Promise<PasswordResetResponse> {
    const response = await fetch(`${getApiBaseUrl()}${getApiPath()}/auth/password-reset/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to verify OTP');
    }

    return result;
  },

  async confirmPasswordReset(email: string, otp: string, newPassword: string): Promise<PasswordResetResponse> {
    const response = await fetch(`${getApiBaseUrl()}${getApiPath()}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp, newPassword }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to reset password');
    }

    return result;
  },

  // Sign in with Google
  async signInWithGoogle(): Promise<User | null> {
    // This will be handled by redirecting to the Google OAuth endpoint
    window.location.href = `${getApiBaseUrl()}${getApiPath()}/auth/google`;
    return null;
  },

  // Handle Google Sign-In callback
  async handleGoogleSignInCallback(): Promise<User | null> {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');

    if (userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        return user;
      } catch (error) {
        console.error('Error parsing user data from URL:', error);
        return null;
      }
    }

    return null;
  },

  // Sign out user
  async signOut(): Promise<void> {
    try {
      await fetch(`${getApiBaseUrl()}${getApiPath()}/auth/logout`, {
        method: 'POST',
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || 'Sign out failed');
    }
  },

  // Get user by ID
  async getUserById(id: string): Promise<User | null> {
    try {
      const response = await fetch(`${getApiBaseUrl()}${getApiPath()}/users/${id}`);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch user');
      }

      return result.user;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  // Get user profile
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const response = await fetch(`${getApiBaseUrl()}${getApiPath()}/users/profile/${userId}`);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch profile');
      }

      return result.user;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, data: Partial<User>): Promise<User | null> {
    try {
      const response = await fetch(`${getApiBaseUrl()}${getApiPath()}/users/profile/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to update user profile');
      }

      return result.user;
    } catch (error) {
      console.error('Error updating user metadata:', error);
      throw error;
    }
  }
};
