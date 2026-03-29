"use client";
// app/(auth)/reset-password/page.tsx — Reset Password

import { useState, useEffect, Suspense } from "react";
import { Zap, Lock, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useThemeStore } from "@/lib/store/authStore";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { theme } = useThemeStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token && mounted) {
      toast.error("Missing reset token. Please request a new password reset.");
    }
  }, [token, mounted]);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast.error("Invalid reset link");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/v2/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          new_password: password 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        toast.success(data.message || "Password reset successful!");
        setTimeout(() => router.push("/login"), 3000);
      } else {
        throw new Error(data.detail || "Failed to reset password");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme === 'light' 
        ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)'
        : 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #1a0a2e 100%)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: theme === 'light' 
          ? 'rgba(255,255,255,0.95)'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: theme === 'light' 
          ? '1px solid rgba(0,0,0,0.08)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        padding: '48px 40px',
        boxShadow: theme === 'light'
          ? '0 32px 80px rgba(0,0,0,0.12)'
          : '0 32px 80px rgba(0,0,0,0.5)'
      }}>
        {/* Logo icon at top */}
        <div style={{
          width: '56px', height: '56px',
          background: 'linear-gradient(135deg, #FFC107, #FF8C00)',
          borderRadius: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 32px rgba(255,193,7,0.3)'
        }}>
          {success ? (
            <CheckCircle className="w-7 h-7 text-[#10B981]" />
          ) : (
            <Zap className="w-7 h-7 text-[#0F0F10]" />
          )}
        </div>

        {/* Title */}
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '800', 
          color: theme === 'light' ? '#1e293b' : '#fff', 
          textAlign: 'center', 
          marginBottom: '8px', 
          letterSpacing: '-0.5px' 
        }}>
          {success ? "Password Reset Successful!" : "Reset Your Password"}
        </h1>

        {/* Subtitle */}
        <p style={{ 
          fontSize: '14px', 
          color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)', 
          textAlign: 'center', 
          marginBottom: success ? '32px' : '32px' 
        }}>
          {success 
            ? "Redirecting you to login..." 
            : "Enter your new password below"
          }
        </p>

        {!success && (
          <form onSubmit={handleSubmit}>
            {/* Password field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)', 
                letterSpacing: '0.05em', 
                marginBottom: '8px', 
                display: 'block' 
              }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)', 
                  pointerEvents: 'none' 
                }} size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  style={{
                    width: '100%', 
                    padding: '12px 16px 12px 44px',
                    background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                    border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', 
                    color: theme === 'light' ? '#1e293b' : '#fff', 
                    fontSize: '14px',
                    outline: 'none', 
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(255,193,7,0.6)'}
                  onBlur={(e) => e.target.style.borderColor = theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Confirm Password field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)', 
                letterSpacing: '0.05em', 
                marginBottom: '8px', 
                display: 'block' 
              }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)', 
                  pointerEvents: 'none' 
                }} size={18} />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  style={{
                    width: '100%', 
                    padding: '12px 16px 12px 44px',
                    background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                    border: theme === 'light' ? '1px solid rgba(0,0,0,0.15)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px', 
                    color: theme === 'light' ? '#1e293b' : '#fff', 
                    fontSize: '14px',
                    outline: 'none', 
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(255,193,7,0.6)'}
                  onBlur={(e) => e.target.style.borderColor = theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Reset Password button */}
            <button 
              type="submit" 
              disabled={loading || !password || !confirmPassword || !token} 
              style={{
                width: '100%', 
                padding: '14px',
                background: 'linear-gradient(135deg, #FFC107, #FF8C00)',
                border: 'none', 
                borderRadius: '12px',
                color: '#000', 
                fontSize: '15px', 
                fontWeight: '700',
                cursor: 'pointer', 
                marginTop: '8px',
                boxShadow: '0 8px 24px rgba(255,193,7,0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                opacity: (loading || !password || !confirmPassword || !token) ? 0.6 : 1,
                pointerEvents: (loading || !password || !confirmPassword || !token) ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!loading && password && confirmPassword && token) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(255,193,7,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,193,7,0.3)';
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>Reset Password</>
              )}
            </button>
          </form>
        )}

        {/* Help text */}
        {!success && (
          <p style={{ 
            textAlign: 'center', 
            marginTop: '24px', 
            fontSize: '13px', 
            color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)' 
          }}>
            Remember your password?{" "}
            <Link href="/login" style={{ color: '#FFC107', textDecoration: 'none', fontWeight: '600' }}>
              Back to login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #1a0a2e 100%)'
      }}>
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
