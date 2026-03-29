"use client";
// app/(auth)/login/page.tsx — Login

import { useState, useEffect } from "react";
import { authApi } from "@/lib/api";
import { useAuthStore, useThemeStore } from "@/lib/store/authStore";
import { Zap, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      form.append("username", username);
      form.append("password", password);
      
      const res = await authApi.login(username, password);
      // In FastAPI OAuth2PasswordRequestForm, typically we get access_token
      setAuth(
        { id: "1", username, email: `${username}@example.com`, role: "admin" }, // Mock user info
        res.data.access_token || "mock_token"
      );
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch {
      toast.error("Invalid credentials. Hint: FastAPI backend might require specific users.");
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
          Welcome to DocuMind
        </h1>

        {/* Subtitle */}
        <p style={{ 
          fontSize: '14px', 
          color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)', 
          textAlign: 'center', 
          marginBottom: '32px' 
        }}>
          Sign in to your enterprise account
        </p>

        <form onSubmit={handleSubmit}>
          {/* Username field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)', 
              letterSpacing: '0.05em', 
              marginBottom: '8px', 
              display: 'block' 
            }}>
              Username
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
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
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

          {/* Password field */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: theme === 'light' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)', 
                letterSpacing: '0.05em' 
              }}>
                Password
              </label>
              <Link 
                href="/forgot-password"
                style={{ 
                  fontSize: '12px', 
                  color: '#FFC107', 
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Forgot password?
              </Link>
            </div>
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

          {/* Sign In button */}
          <button 
            type="submit" 
            disabled={loading || !username || !password} 
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
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(255,193,7,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,193,7,0.3)';
            }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        {/* Bottom link text */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '24px', 
          fontSize: '13px', 
          color: theme === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)' 
        }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: '#FFC107', textDecoration: 'none', fontWeight: '600' }}>
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
