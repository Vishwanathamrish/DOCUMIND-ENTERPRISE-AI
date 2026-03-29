"use client";
// app/(auth)/forgot-password/page.tsx — Forgot Password

import { useState, useEffect } from "react";
import { Zap, Mail, ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useThemeStore } from "@/lib/store/authStore";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { theme } = useThemeStore();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/v2/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || "Password reset link sent! Check your email.");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        throw new Error(data.detail || "Failed to send reset link");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset link. Please try again.");
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
        {/* Back button */}
        <Link 
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: theme === 'light' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
            fontSize: '13px',
            textDecoration: 'none',
            marginBottom: '24px',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = theme === 'light' ? '#000' : '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = theme === 'light' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>

        {/* Logo icon at top */}
        <div style={{
          width: '56px', height: '56px',
          background: 'linear-gradient(135deg, #FFC107, #FF8C00)',
          borderRadius: '16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 32px rgba(255,193,7,0.3)'
        }}>
          <Zap className="w-7 h-7 text-[#0F0F10]" />
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
          Forgot Password?
        </h1>

        {/* Subtitle */}
        <p style={{ 
          fontSize: '14px', 
          color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)', 
          textAlign: 'center', 
          marginBottom: '32px' 
        }}>
          No worries! Enter your email and we'll send you reset instructions.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)', 
              letterSpacing: '0.05em', 
              marginBottom: '8px', 
              display: 'block' 
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: theme === 'light' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)', 
                pointerEvents: 'none' 
              }} size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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

          {/* Send Reset Link button */}
          <button 
            type="submit" 
            disabled={loading || !email} 
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
              opacity: (loading || !email) ? 0.6 : 1,
              pointerEvents: (loading || !email) ? 'none' : 'auto'
            }}
            onMouseEnter={(e) => {
              if (!loading && email) {
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
                Sending...
              </>
            ) : (
              <>Send Reset Link</>
            )}
          </button>
        </form>

        {/* Help text */}
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
      </div>
    </div>
  );
}
