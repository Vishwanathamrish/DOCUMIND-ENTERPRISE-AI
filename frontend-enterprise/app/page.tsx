"use client";
// app/page.tsx — Premium UAE Landing Page with Bilingual Support

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Upload, Brain, BarChart3, Shield, Globe, FileText, CheckCircle, ArrowRight, Play, X } from "lucide-react";

// Bilingual content
const content = {
  en: {
    nav: {
      features: "Features",
      howItWorks: "How It Works",
      pricing: "Pricing",
      login: "Sign In",
      register: "Get Started Free"
    },
    hero: {
      badge: "⚡ AI-POWERED DOCUMENT INTELLIGENCE",
      headline1: "Transform Documents Into",
      headline2: "Intelligence",
      subtitle: "Upload invoices, receipts, and contracts. DocuMind extracts, analyzes, and answers questions about your documents instantly using advanced AI.",
      cta1: "Start Free Trial",
      cta2: "Watch Demo",
      stat1: { value: "10,000+", label: "Documents Processed" },
      stat2: { value: "98.2%", label: "Extraction Accuracy" },
      stat3: { value: "3.1s", label: "Avg Processing Time" },
    },
    features: {
      title: "Everything You Need",
      subtitle: "Powerful features built for UAE enterprise document workflows",
      items: [
        { icon: "⚡", title: "Lightning Fast OCR", desc: "Extract text from PDFs, images, and scanned documents in seconds with 98%+ accuracy" },
        { icon: "🤖", title: "AI Research Assistant", desc: "Ask questions about your documents in natural language and get instant accurate answers" },
        { icon: "📊", title: "Smart Analytics", desc: "Track processing volume, accuracy trends, and document insights with real-time dashboards" },
        { icon: "🔒", title: "Enterprise Security", desc: "Bank-level encryption with user-isolated data. Your documents are only visible to you" },
        { icon: "🌐", title: "Arabic & English", desc: "Full RTL support for Arabic documents. Seamlessly switch between languages" },
        { icon: "📁", title: "Multi-Format Support", desc: "Process PDF, JPEG, PNG, TIFF, and WEBP files up to 50 pages and 20MB" },
      ]
    },
    steps: {
      title: "How It Works",
      subtitle: "Three simple steps to intelligent document processing",
      items: [
        { num: "01", title: "Upload Document", desc: "Drag & drop or browse to upload PDF, images, or scanned files" },
        { num: "02", title: "AI Extraction", desc: "DocuMind automatically extracts all fields, tables, and metadata" },
        { num: "03", title: "Search & Analyze", desc: "Ask questions, export data, and gain insights from your documents" },
      ]
    },
    docTypes: {
      title: "Supported Document Types",
      subtitle: "Specialized extraction for every document type",
      items: [
        { type: "INVOICE", color: "#FFC107", fields: ["Vendor Name", "Invoice Number", "Total Amount", "Tax Amount", "Line Items"] },
        { type: "RECEIPT", color: "#10B981", fields: ["Store Name", "Receipt Number", "Subtotal", "Tax", "Payment Method"] },
        { type: "CONTRACT", color: "#8B5CF6", fields: ["Company Name", "Client Name", "Contract Value", "Start/End Date", "Signatories"] },
      ]
    },
    cta: {
      title: "Ready to Transform Your Document Workflow?",
      subtitle: "Join thousands of UAE enterprises using DocuMind AI",
      button: "Get Started Free"
    },
    footer: {
      tagline: "Enterprise AI Document Intelligence Platform",
      links: ["Features", "Dashboard", "Sign In", "Register"],
      copy: "© 2026 DocuMind Enterprise AI. All rights reserved. Dubai, UAE"
    }
  },
  ar: {
    nav: {
      features: "المميزات",
      howItWorks: "كيف يعمل",
      pricing: "الأسعار",
      login: "تسجيل الدخول",
      register: "ابدأ مجاناً"
    },
    hero: {
      badge: "⚡ منصة ذكاء اصطناعي لمعالجة المستندات",
      headline1: "حوّل مستنداتك إلى",
      headline2: "ذكاء",
      subtitle: "ارفع الفواتير والإيصالات والعقود. يستخرج DocuMind المعلومات ويحللها ويجيب على أسئلتك فوراً باستخدام أحدث تقنيات الذكاء الاصطناعي.",
      cta1: "ابدأ النسخه التجريبية",
      cta2: "شاهد العرض",
      stat1: { value: "+10,000", label: "مستند تمت معالجته" },
      stat2: { value: "98.2%", label: "دقة الاستخراج" },
      stat3: { value: "3.1 ثانية", label: "متوسط وقت المعالجة" },
    },
    features: {
      title: "كل ما تحتاجه",
      subtitle: "ميزات قوية مصممة لسير عمل مستندات الشركات في الإمارات",
      items: [
        { icon: "⚡", title: "OCR فائق السرعة", desc: "استخراج النص من ملفات PDF والصور والمستندات الممسوحة ضوئياً في ثوانٍ بدقة تتجاوز 98%" },
        { icon: "🤖", title: "مساعد بحث ذكي", desc: "اطرح أسئلة حول مستنداتك بلغة طبيعية واحصل على إجابات فورية ودقيقة" },
        { icon: "📊", title: "تحليلات ذكية", desc: "تتبع حجم المعالجة واتجاهات الدقة ورؤى المستندات من خلال لوحات تحكم في الوقت الفعلي" },
        { icon: "🔒", title: "أمان على مستوى المؤسسات", desc: "تشفير بمستوى البنوك مع عزل بيانات المستخدم. مستنداتك لا يراها إلا أنت" },
        { icon: "🌐", title: "عربي وإنجليزي", desc: "دعم كامل للكتابة من اليمين إلى اليسار. التبديل بين اللغتين بسلاسة تامة" },
        { icon: "📁", title: "دعم صيغ متعددة", desc: "معالجة ملفات PDF وJPEG وPNG وTIFF وWEBP حتى 50 صفحة و20 ميجابايت" },
      ]
    },
    steps: {
      title: "كيف يعمل النظام",
      subtitle: "ثلاث خطوات بسيطة لمعالجة المستندات بذكاء",
      items: [
        { num: "01", title: "رفع المستند", desc: "اسحب وأفلت أو تصفح لرفع ملفات PDF أو الصور أو المستندات الممسوحة" },
        { num: "02", title: "استخراج بالذكاء الاصطناعي", desc: "يستخرج DocuMind تلقائياً جميع الحقول والجداول والبيانات الوصفية" },
        { num: "03", title: "البحث والتحليل", desc: "اطرح أسئلة وصدّر البيانات واستخلص رؤى من مستنداتك" },
      ]
    },
    docTypes: {
      title: "أنواع المستندات المدعومة",
      subtitle: "استخراج متخصص لكل نوع من أنواع المستندات",
      items: [
        { type: "فاتورة", color: "#FFC107", fields: ["اسم المورد", "رقم الفاتورة", "المبلغ الإجمالي", "مبلغ الضريبة", "بنود الفاتورة"] },
        { type: "إيصال", color: "#10B981", fields: ["اسم المتجر", "رقم الإيصال", "المجموع الفرعي", "الضريبة", "طريقة الدفع"] },
        { type: "عقد", color: "#8B5CF6", fields: ["اسم الشركة", "اسم العميل", "قيمة العقد", "تاريخ البداية/النهاية", "الموقعون"] },
      ]
    },
    cta: {
      title: "هل أنت مستعد لتحويل سير عمل مستنداتك؟",
      subtitle: "انضم إلى آلاف الشركات الإماراتية التي تستخدم DocuMind AI",
      button: "ابدأ مجاناً"
    },
    footer: {
      tagline: "منصة الذكاء الاصطناعي للمستندات على مستوى المؤسسات",
      links: ["المميزات", "لوحة التحكم", "تسجيل الدخول", "إنشاء حساب"],
      copy: "© 2026 DocuMind Enterprise AI. جميع الحقوق محفوظة. دبي، الإمارات العربية المتحدة"
    }
  }
};

export default function LandingPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [showVideo, setShowVideo] = useState(false);
  const c = content[lang];
  const isAr = lang === "ar";

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ fontFamily: isAr ? "Tajawal, Arial, sans-serif" : "Outfit, Inter, sans-serif", minHeight: "100vh", background: "#050d1a", overflowX: "hidden" }}>
      
      {/* NAVBAR */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: "rgba(10,15,30,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: isAr ? "0 24px 0 48px" : "0 48px 0 24px",
        height: "68px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)"
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => window.location.href = "/"}>
          <div style={{ width: "40px", height: "40px", background: "linear-gradient(135deg, #FFC107, #FF8C00)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={20} color="#000" />
          </div>
          <div>
            <p style={{ color: "#fff", fontWeight: "800", fontSize: "16px", margin: 0, lineHeight: 1 }}>DocuMind</p>
            <p style={{ color: "#FFC107", fontSize: "9px", margin: 0, letterSpacing: "0.15em", lineHeight: 1 }}>ENTERPRISE AI</p>
          </div>
        </div>

        {/* Nav links - hidden on mobile */}
        <div style={{ display: "flex", gap: "32px" }} className="hidden md:flex">
          {[c.nav.features, c.nav.howItWorks, c.nav.pricing].map((link, i) => (
            <a 
              key={i}
              href={`#${link.toLowerCase().replace(/\s/g, "")}`}
              style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textDecoration: "none", cursor: "pointer", transition: "color 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
              onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.6)"}
            >
              {link}
            </a>
          ))}
        </div>

        {/* Right side: Lang toggle + Auth buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "20px",
              border: "1px solid rgba(255,193,7,0.3)",
              background: "rgba(255,193,7,0.08)",
              color: "#FFC107", fontSize: "13px", cursor: "pointer",
              fontWeight: "600", transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,193,7,0.15)";
              e.currentTarget.style.borderColor = "rgba(255,193,7,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,193,7,0.08)";
              e.currentTarget.style.borderColor = "rgba(255,193,7,0.3)";
            }}
          >
            🌐 {lang === "en" ? "العربية" : "English"}
          </button>

          {/* Login */}
          <button 
            onClick={() => router.push("/login")}
            style={{ 
              padding: "8px 20px", 
              borderRadius: "10px", 
              border: "1px solid rgba(255,255,255,0.15)", 
              background: "transparent", 
              color: "#fff", 
              fontSize: "14px", 
              cursor: "pointer",
              display: "inline-block",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            {c.nav.login}
          </button>

          {/* Register */}
          <button 
            onClick={() => router.push("/register")}
            style={{ 
              padding: "8px 20px", 
              borderRadius: "10px", 
              border: "none", 
              background: "linear-gradient(135deg, #FFC107, #FF8C00)", 
              color: "#000", 
              fontSize: "14px", 
              fontWeight: "700", 
              cursor: "pointer", 
              boxShadow: "0 4px 16px rgba(255,193,7,0.3)",
              display: "inline-block",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,193,7,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,193,7,0.3)";
            }}
          >
            {c.nav.register}
          </button>

        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050d1a 0%, #0a1628 40%, #0d0a1f 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "148px 24px 80px",
        position: "relative", overflow: "hidden"
      }}>
        {/* Glow orbs */}
        <div style={{ position: "absolute", top: "10%", left: isAr ? "auto" : "5%", right: isAr ? "5%" : "auto", width: "500px", height: "500px", background: "rgba(255,193,7,0.06)", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none" as const }} />
        <div style={{ position: "absolute", bottom: "10%", right: isAr ? "auto" : "5%", left: isAr ? "5%" : "auto", width: "400px", height: "400px", background: "rgba(139,92,246,0.05)", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none" as const }} />

        {/* Badge */}
        <span style={{ 
          background: "rgba(255,193,7,0.1)", 
          border: "1px solid rgba(255,193,7,0.25)", 
          borderRadius: "100px", 
          padding: "8px 20px", 
          fontSize: "11px", 
          color: "#FFC107", 
          letterSpacing: "0.12em", 
          marginBottom: "32px", 
          display: "inline-block",
          fontWeight: "700"
        }}>
          {c.hero.badge}
        </span>

        {/* Headline */}
        <h1 style={{ 
          fontSize: "clamp(36px, 6vw, 72px)", 
          fontWeight: "900", 
          color: "#fff", 
          lineHeight: 1.1, 
          letterSpacing: "-2px", 
          margin: "0 0 16px", 
          maxWidth: "800px" 
        }}>
          {c.hero.headline1}<br/>
          <span style={{ 
            background: "linear-gradient(135deg, #FFC107, #FF8C00)", 
            WebkitBackgroundClip: "text", 
            WebkitTextFillColor: "transparent" 
          }}>
            {c.hero.headline2}
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{ 
          fontSize: "18px", 
          color: "rgba(255,255,255,0.5)", 
          maxWidth: "600px", 
          lineHeight: 1.8, 
          marginBottom: "48px" 
        }}>
          {c.hero.subtitle}
        </p>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" as const, justifyContent: "center", marginBottom: "80px" }}>
          <button 
            onClick={() => router.push("/register")}
            style={{ 
              padding: "16px 36px", 
              borderRadius: "14px", 
              border: "none", 
              background: "linear-gradient(135deg, #FFC107, #FF8C00)", 
              color: "#000", 
              fontSize: "16px", 
              fontWeight: "700", 
              cursor: "pointer", 
              boxShadow: "0 8px 24px rgba(255,193,7,0.3)",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(255,193,7,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(255,193,7,0.3)";
            }}
          >
            {c.hero.cta1}
            <ArrowRight size={18} style={{ transform: isAr ? "rotate(180deg)" : "none" }} />
          </button>
          
          <button 
            onClick={() => setShowVideo(true)}
            style={{ 
              padding: "16px 36px", 
              borderRadius: "14px", 
              border: "1px solid rgba(255,255,255,0.2)", 
              background: "rgba(255,255,255,0.05)", 
              color: "#fff", 
              fontSize: "16px", 
              fontWeight: "700", 
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
          >
            <Play size={18} fill="#fff" />
            {c.hero.cta2}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" as const, justifyContent: "center" }}>
          {[c.hero.stat1, c.hero.stat2, c.hero.stat3].map((stat, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <p style={{ fontSize: "32px", fontWeight: "900", color: "#FFC107", margin: 0, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "8px 0 0", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" style={{ padding: "120px 24px", background: "#0a1628" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#fff", margin: "0 0 16px", letterSpacing: "-1px" }}>
              {c.features.title}
            </h2>
            <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.5)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
              {c.features.subtitle}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "32px" }}>
            {c.features.items.map((feature, i) => (
              <div 
                key={i}
                style={{
                  padding: "32px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "20px",
                  transition: "all 0.3s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,193,7,0.2)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: "40px", marginBottom: "16px" }}>{feature.icon}</div>
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#fff", margin: "0 0 12px" }}>{feature.title}</h3>
                <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="howitworks" style={{ padding: "120px 24px", background: "#050d1a" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#fff", margin: "0 0 16px", letterSpacing: "-1px" }}>
              {c.steps.title}
            </h2>
            <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.5)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
              {c.steps.subtitle}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "40px" }}>
            {c.steps.items.map((step, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div style={{ 
                  fontSize: "64px", 
                  fontWeight: "900", 
                  color: "#FFC107", 
                  lineHeight: 1, 
                  marginBottom: "16px",
                  textShadow: "0 0 40px rgba(255,193,7,0.5)"
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: "24px", fontWeight: "800", color: "#fff", margin: "0 0 12px" }}>{step.title}</h3>
                <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                
                {i < c.steps.items.length - 1 && (
                  <div style={{ 
                    position: "absolute", 
                    top: "40px", 
                    right: isAr ? "auto" : "-20px", 
                    left: isAr ? "-20px" : "auto",
                    width: "40px", 
                    height: "2px", 
                    background: "linear-gradient(90deg, rgba(255,193,7,0.4), rgba(255,193,7,0.15))" 
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DOCUMENT TYPES */}
      <section style={{ padding: "120px 24px", background: "#0a1628" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#fff", margin: "0 0 16px", letterSpacing: "-1px" }}>
              {c.docTypes.title}
            </h2>
            <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.5)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
              {c.docTypes.subtitle}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "32px" }}>
            {c.docTypes.items.map((doc, i) => (
              <div 
                key={i}
                style={{
                  padding: "40px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "20px",
                  borderTop: `4px solid ${doc.color}`,
                  transition: "all 0.3s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = doc.color;
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <h3 style={{ fontSize: "28px", fontWeight: "900", color: doc.color, margin: "0 0 24px", letterSpacing: "0.05em" }}>
                  {doc.type}
                </h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {doc.fields.map((field, j) => (
                    <li key={j} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "12px", 
                      padding: "12px 0", 
                      borderBottom: j < doc.fields.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      fontSize: "15px",
                      color: "rgba(255,255,255,0.7)"
                    }}>
                      <CheckCircle size={16} color={doc.color} />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section style={{ 
        padding: "120px 24px", 
        background: "linear-gradient(135deg, rgba(255,193,7,0.1), rgba(255,140,0,0.05))",
        textAlign: "center"
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: "900", color: "#fff", margin: "0 0 16px", letterSpacing: "-1px" }}>
            {c.cta.title}
          </h2>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)", marginBottom: "40px", lineHeight: 1.6 }}>
            {c.cta.subtitle}
          </p>
          <button 
            onClick={() => router.push("/register")}
            style={{ 
              padding: "18px 48px", 
              borderRadius: "14px", 
              border: "none", 
              background: "linear-gradient(135deg, #FFC107, #FF8C00)", 
              color: "#000", 
              fontSize: "18px", 
              fontWeight: "800", 
              cursor: "pointer", 
              boxShadow: "0 12px 32px rgba(255,193,7,0.3)",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 16px 40px rgba(255,193,7,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(255,193,7,0.3)";
            }}
          >
            {c.cta.button}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "60px 24px", background: "#050d1a", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexWrap: "wrap" as const, justifyContent: "space-between", gap: "40px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "40px", height: "40px", background: "linear-gradient(135deg, #FFC107, #FF8C00)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={20} color="#000" />
              </div>
              <div>
                <p style={{ color: "#fff", fontWeight: "800", fontSize: "16px", margin: 0, lineHeight: 1 }}>DocuMind</p>
                <p style={{ color: "#FFC107", fontSize: "9px", margin: 0, letterSpacing: "0.15em", lineHeight: 1 }}>ENTERPRISE AI</p>
              </div>
            </div>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0, maxWidth: "300px" }}>
              {c.footer.tagline}
            </p>
          </div>

          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" as const }}>
            {c.footer.links.map((link, i) => {
              // Map footer links to routes
              const linkRoutes: Record<string, string> = {
                "Features": "#features",
                "المميزات": "#features",
                "Dashboard": "/login",  // Redirect to login if not authenticated
                "لوحة التحكم": "/login",
                "Sign In": "/login",
                "تسجيل الدخول": "/login",
                "Register": "/register",
                "إنشاء حساب": "/register",
                "Get Started Free": "/register",
                "ابدأ مجاناً": "/register",
              };
              
              const route = linkRoutes[link] || "#";
              
              return (
                <a 
                  key={i}
                  href={route}
                  onClick={(e) => {
                    if (route.startsWith("/")) {
                      e.preventDefault();
                      router.push(route);
                    }
                  }}
                  style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", textDecoration: "none", transition: "color 0.2s", cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
                >
                  {link}
                </a>
              );
            })}
          </div>
        </div>
        
        <div style={{ maxWidth: "1200px", margin: "40px auto 0", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: isAr ? "left" : "center" }}>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", margin: 0 }}>
            {c.footer.copy}
          </p>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideo && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "24px"
          }}
          onClick={() => setShowVideo(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowVideo(false)}
            style={{
              position: "absolute",
              top: "24px",
              right: isAr ? "auto" : "24px",
              left: isAr ? "24px" : "auto",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s",
              color: "#fff"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
          >
            <X size={24} />
          </button>

          {/* Video container with responsive aspect ratio */}
          <div 
            style={{
              width: "100%",
              maxWidth: "1280px",
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 32px 96px rgba(0,0,0,0.8)",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Local video player */}
            <video
              autoPlay
              controls
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain"
              }}
            >
              <source src="/demo_video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
}
