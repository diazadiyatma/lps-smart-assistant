"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";
import toast from "react-hot-toast";
import { 
  ShieldCheck, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Coins, 
  Percent, 
  User, 
  Building2, 
  FileCheck,
  Scale,
  RefreshCw,
  MessageSquare,
  Send,
  X,
  Upload,
  Image as ImageIcon,
  LogOut,
  History,
  Calculator,
  Sun,
  Moon
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CalculationResult {
  status: string;
  is_guaranteed: boolean;
  reason?: string;
}

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

export default function Home() {
  const router = useRouter();
  
  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      setTheme("light");
      document.documentElement.classList.add("light");
    } else {
      setTheme("dark");
      document.documentElement.classList.remove("light");
    }
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      localStorage.setItem("theme", "light");
      document.documentElement.classList.add("light");
    } else {
      setTheme("dark");
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.remove("light");
    }
  };

  // Auth Session States
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<"calculator" | "history">("calculator");

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [bankName, setBankName] = useState("");
  const [balance, setBalance] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [isRecorded, setIsRecorded] = useState(false);
  const [isNotHarmful, setIsNotHarmful] = useState(false);

  // Scan Document State
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: "Halo! Saya LPS Smart-Assistant. Ada yang bisa saya bantu terkait penjaminan simpanan Anda di bank?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Verification Overlay Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalResult, setModalResult] = useState<CalculationResult | null>(null);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit History States
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Auth Redirect Guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
      if (!session) {
        router.push("/login");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch audit history from backend using token
  const fetchAuditHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;
      const response = await axios.get(`${API_BASE_URL}/api/v1/audit-history`, {
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`
        }
      });
      setAuditHistory(response.data);
    } catch (err: any) {
      const serverError = err.response?.data?.detail || err.message;
      toast.error(`Gagal memuat riwayat audit: ${serverError}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && session) {
      fetchAuditHistory();
    }
  }, [activeTab, session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar.");
    router.push("/login");
  };

  // Formatter for Currency Info (Rupiah)
  const formatCurrency = (val: string) => {
    if (!val) return "";
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(num);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const headers = currentSession ? { Authorization: `Bearer ${currentSession.access_token}` } : {};

      const response = await axios.post(`${API_BASE_URL}/api/v1/calculate`, {
        customer_name: customerName,
        bank_name: bankName,
        total_balance: parseFloat(balance),
        interest_rate: parseFloat(interestRate),
        is_recorded: isRecorded,
        is_not_harmful: isNotHarmful,
      }, { headers });

      setModalResult(response.data);
      setIsModalOpen(true);
      toast.success("Simulasi verifikasi audit sukses disimpan!");
    } catch (err: any) {
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === "string") {
          setError(detail);
          toast.error(detail);
        } else if (Array.isArray(detail)) {
          const detailMsg = detail.map((d: any) => d.msg).join(", ");
          setError(detailMsg);
          toast.error(detailMsg);
        } else {
          setError("Gagal menjalankan logika verifikasi.");
          toast.error("Gagal menjalankan logika verifikasi.");
        }
      } else {
        setError("Gagal menghubungi server verifikasi.");
        toast.error("Gagal menghubungi server verifikasi.");
      }
    } finally {
      setLoading(false);
    }
  };

  // OCR Document Upload Handler
  const handleDocumentScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // File size validation (limit 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar! Batas maksimal adalah 5MB.");
      return;
    }
    
    // Set preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const formData = new FormData();
    formData.append("file", file);

    setScanLoading(true);
    setScanError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/scan-document`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      const { extracted_balance, extracted_interest_rate, extracted_customer_name, raw_text } = response.data;
      
      if (extracted_customer_name) {
        setCustomerName(extracted_customer_name);
      }
      if (extracted_balance !== null && extracted_balance !== undefined) {
        setBalance(extracted_balance.toString());
      }
      if (extracted_interest_rate !== null && extracted_interest_rate !== undefined) {
        setInterestRate(extracted_interest_rate.toString());
      }

      // Try to extract bank name from raw_text
      if (raw_text) {
        const commonBanks = ["Mandiri", "BRI", "BCA", "BNI", "BTN", "CIMB Niaga", "Danamon", "Permata", "Mega", "BJB"];
        for (const bank of commonBanks) {
          if (new RegExp(bank, "i").test(raw_text)) {
            setBankName(`Bank ${bank}`);
            break;
          }
        }
      }
      
      if (extracted_balance === null && extracted_interest_rate === null && !extracted_customer_name) {
        setScanError("OCR berhasil, namun data nasabah, saldo, atau bunga tidak terdeteksi. Silakan isi manual.");
        toast("OCR berhasil, tetapi data tidak terdeteksi otomatis.", { icon: "⚠️" });
      } else {
        toast.success("Pemindaian dokumen berhasil!");
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Gagal mengurai dokumen. Pastikan gambar jelas.";
      setScanError(errMsg);
      toast.error(errMsg);
    } finally {
      setScanLoading(false);
      // Reset input element
      e.target.value = "";
    }
  };

  // Chat message submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/chat`, {
        message: userText
      });
      setChatMessages((prev) => [...prev, { sender: "bot", text: response.data.reply }]);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { sender: "bot", text: "Koneksi ke server gagal. Harap pastikan backend berjalan di port 8000." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setBankName("");
    setBalance("");
    setInterestRate("");
    setIsRecorded(false);
    setIsNotHarmful(false);
    setError(null);
    setPreviewUrl(null);
  };

  const handleDownloadCertificate = async () => {
    if (!modalResult) return;
    setPdfLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/download-certificate`,
        {
          customer_name: customerName,
          bank_name: bankName,
          total_balance: parseFloat(balance),
          interest_rate: parseFloat(interestRate),
          is_guaranteed: modalResult.is_guaranteed,
        },
        {
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const formattedName = (customerName || "Simulasi").trim().replace(/\s+/g, "_");
      link.setAttribute("download", `Sertifikat_LPS_${formattedName}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Sertifikat PDF berhasil diunduh!");
    } catch (err: any) {
      console.error("Gagal mendownload PDF:", err);
      toast.error("Gagal mengunduh sertifikat PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
        <span className="text-sm font-semibold tracking-wide">Memeriksa Autentikasi...</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-300 relative">
      {/* Premium Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-border p-1 shadow-sm shrink-0">
              <img src="/logo.png" alt="LPS Smart-Assistant Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LPS Smart-Assistant</h1>
              <p className="text-xs text-muted-foreground opacity-70">Kalkulator 3T Cerdas & Audit Kepatuhan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="text-xs font-semibold px-3 py-1 bg-secondary rounded-full border border-border text-secondary-foreground">
              LPS Rules: Active Capping (4.25%)
            </span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200 flex items-center justify-center"
              title={theme === "dark" ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500 fill-indigo-500" />
              )}
            </button>
            {session && (
              <div className="flex items-center gap-2 ml-3">
                <span className="text-xs text-muted-foreground hidden md:inline max-w-[150px] truncate">
                  {session.user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content (Bento Grid Layout) */}
      <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 border-b border-border pb-px">
          <button
            onClick={() => setActiveTab("calculator")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition duration-200 border-b-2 -mb-px ${
              activeTab === "calculator"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Kalkulator & Pemindai 3T
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition duration-200 border-b-2 -mb-px ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-4 h-4" />
            Riwayat Audit
          </button>
        </div>

        {activeTab === "calculator" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-12 glow-card bg-card p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="max-w-2xl">
                <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-3 py-1 rounded-full">Panduan Lembaga Penjamin Simpanan (LPS)</span>
                <h2 className="text-2xl font-bold mt-2 tracking-tight">Apakah simpanan Anda memenuhi Kriteria 3T?</h2>
                <p className="text-sm mt-1 text-muted-foreground leading-relaxed opacity-80">
                  Untuk menjamin simpanan Anda hingga <strong>Rp 2.000.000.000</strong>, Lembaga Penjamin Simpanan (LPS) mewajibkan pemeriksaan kepatuhan di tiga pilar utama.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
                {["Tercatat", "Tepat Bunga", "Tidak Merugikan"].map((rule, idx) => (
                  <div key={idx} className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
                    <p className="text-xs font-bold text-primary">Pilar {idx + 1}</p>
                    <p className="text-sm font-semibold mt-1">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid Box: 3T Calculator + Scan Bank Book Adjacent Layout (Col Span 8) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* The Main 3T Calculator Input Form (Col Span 8) */}
              <div className="md:col-span-8 glow-card bg-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
                  <Scale className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold">Formulir Verifikasi 3T</h3>
                </div>

                {error && (
                  <div className="p-4 mb-4 bg-error/10 border border-error/20 rounded-xl text-error text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  {/* Customer Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Nama Nasabah
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="contoh: John Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm ${scanLoading ? "shimmer-input-active" : ""}`}
                      disabled={scanLoading}
                    />
                  </div>

                  {/* Bank Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Nama Bank
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="contoh: Bank Mandiri"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm ${scanLoading ? "shimmer-input-active" : ""}`}
                      disabled={scanLoading}
                    />
                  </div>

                  {/* Total Account Balance */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" /> Total Saldo Rekening
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        step="any"
                        placeholder="contoh: 100000000"
                        value={balance}
                        onChange={(e) => setBalance(e.target.value)}
                        className={`w-full pl-4 pr-12 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm ${scanLoading ? "shimmer-input-active" : ""}`}
                        disabled={scanLoading}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold opacity-60">IDR</span>
                    </div>
                    {balance && (
                      <span className="text-xs text-primary font-medium block mt-1">
                        {formatCurrency(balance)}
                      </span>
                    )}
                  </div>

                  {/* Bank Interest Rate */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" /> Suku Bunga Bank
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="contoh: 3.75"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className={`w-full pl-4 pr-12 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm ${scanLoading ? "shimmer-input-active" : ""}`}
                        disabled={scanLoading}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold opacity-60">%</span>
                    </div>
                  </div>

                  {/* Compliance Checkbox 1 */}
                  <div className="p-3 rounded-xl border border-border bg-secondary/30 flex items-start gap-3">
                    <input
                      id="checkbox-recorded"
                      type="checkbox"
                      checked={isRecorded}
                      onChange={(e) => setIsRecorded(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-0.5 cursor-pointer"
                    />
                    <label htmlFor="checkbox-recorded" className="text-xs font-medium leading-relaxed select-none cursor-pointer">
                      <strong>T1:</strong> Apakah simpanan Anda tercatat secara resmi dalam pembukuan bank?
                    </label>
                  </div>

                  {/* Compliance Checkbox 2 */}
                  <div className="p-3 rounded-xl border border-border bg-secondary/30 flex items-start gap-3">
                    <input
                      id="checkbox-no-harm"
                      type="checkbox"
                      checked={isNotHarmful}
                      onChange={(e) => setIsNotHarmful(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-0.5 cursor-pointer"
                    />
                    <label htmlFor="checkbox-no-harm" className="text-xs font-medium leading-relaxed select-none cursor-pointer">
                      <strong>T3:</strong> Apakah Anda sepenuhnya bebas dari tindakan apa pun yang merugikan bank?
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={loading || scanLoading}
                      className="flex-1 bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:opacity-90 disabled:opacity-50 transition duration-200 flex items-center justify-center gap-2 text-sm shadow-md"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        "Verifikasi Status Penjaminan Simpanan"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={scanLoading}
                      className="px-4 py-3 rounded-xl border border-border hover:bg-secondary transition duration-200 disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Scan Area directly adjacent to form (Col Span 4) */}
              <div className="md:col-span-4 glow-card bg-card p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
                    <FileCheck className="w-5 h-5 text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pemindaian OCR</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Unggah foto/pindai halaman buku tabungan atau rekening koran Anda. Sistem AI kami akan mengekstrak saldo dan suku bunga secara instan.
                  </p>

                  {scanError && (
                    <div className="p-3 mb-4 bg-error/10 border border-error/20 rounded-xl text-error text-[10px] leading-relaxed">
                      {scanError}
                    </div>
                  )}

                  <div className="relative border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center hover:bg-secondary/40 transition duration-200 cursor-pointer overflow-hidden min-h-[150px]">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDocumentScan}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={scanLoading}
                    />
                    
                    {/* Laser & Shimmer Scan Overlay when scanning */}
                    {scanLoading && (
                      <>
                        <div className="scan-laser" />
                        <div className="scan-overlay" />
                      </>
                    )}

                    {previewUrl ? (
                      <div className="flex flex-col items-center text-center gap-2 w-full h-full relative">
                        <img 
                          src={previewUrl} 
                          alt="Pratinjau dokumen" 
                          className={`max-h-24 max-w-full object-contain rounded-lg border border-border shadow-sm transition-all duration-300 ${scanLoading ? "brightness-75 contrast-125" : ""}`} 
                        />
                        {scanLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                            <span className="text-[10px] font-semibold text-white bg-primary px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md animate-pulse">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Memindai...
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-4 mt-1">
                            <span className="text-xs font-bold text-primary flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" /> Ubah Dokumen
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPreviewUrl(null);
                                setScanError(null);
                              }}
                              className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 z-20 relative cursor-pointer"
                              title="Hapus Dokumen"
                            >
                              <X className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    ) : scanLoading ? (
                      <div className="flex flex-col items-center gap-2 relative z-20 py-4">
                        <Upload className="w-8 h-8 text-primary animate-bounce" />
                        <span className="text-xs font-bold text-primary">Memindai buku tabungan...</span>
                        <span className="text-[10px] text-muted-foreground">Mengekstrak rincian simpanan...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center gap-2">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <span className="text-xs font-bold">Unggah Buku Tabungan</span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG, atau WEBP</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-primary" /> Ukuran file maks: 5MB
                  </span>
                </div>
              </div>

            </div>

            {/* Grid Box: Capping / Guidelines Widget (Col Span 4) */}
            <div className="lg:col-span-4 glow-card bg-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
                  <h3 className="text-lg font-bold">Batas Penjaminan LPS</h3>
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Maksimal Saldo Dijamin</p>
                    <p className="text-2xl font-bold tracking-tight text-primary mt-1">Rp 2.000.000.000</p>
                  </div>
                  
                  <div className="p-4 bg-secondary/50 rounded-xl">
                    <p className="text-xs text-muted-foreground">Maksimal Suku Bunga Dijamin</p>
                    <p className="text-2xl font-bold tracking-tight text-primary mt-1">4.25% <span className="text-xs font-normal text-muted-foreground">(Rupiah)</span></p>
                  </div>

                  <div className="text-xs leading-relaxed text-muted-foreground space-y-2 pt-2">
                    <p><strong>Note:</strong> Syarat 3T wajib dipenuhi agar simpanan Anda aman dijamin oleh LPS:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Tercatat</strong> dalam pembukuan bank.</li>
                      <li><strong>Tingkat bunga</strong> tidak melebihi suku bunga penjaminan.</li>
                      <li><strong>Tidak merugikan</strong> bank (tidak memiliki kredit macet).</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center text-[10px] text-muted-foreground opacity-60">
                LPS Smart-Assistant v1.0.0
              </div>
            </div>
          </div>
        ) : (
          /* Audit History Table View */
          <div className="glow-card bg-card p-6 rounded-2xl border border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">Riwayat Audit Kepatuhan 3T</h3>
              </div>
              <button
                onClick={fetchAuditHistory}
                disabled={loadingHistory}
                className="px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                Segarkan
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Mengambil riwayat audit...</span>
              </div>
            ) : auditHistory.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground opacity-60">
                  <History className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Belum ada riwayat audit</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                  Lakukan pemindaian dokumen atau isi formulir kalkulator 3T untuk mulai menyimpan riwayat verifikasi Anda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4">No</th>
                      <th className="py-3.5 px-4">Nama Nasabah</th>
                      <th className="py-3.5 px-4">Nama Bank</th>
                      <th className="py-3.5 px-4">Total Simpanan</th>
                      <th className="py-3.5 px-4">Bunga</th>
                      <th className="py-3.5 px-4">Status Penjaminan</th>
                      <th className="py-3.5 px-4 text-right">Tanggal Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditHistory.map((item, idx) => {
                      const isEligible = item.status_jaminan === "Fully Eligible for Payout";
                      return (
                        <tr key={item.id} className="hover:bg-secondary/20 transition duration-150">
                          <td className="py-3.5 px-4 font-medium opacity-70">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-bold">{item.nama_nasabah}</td>
                          <td className="py-3.5 px-4 opacity-90">{item.nama_bank}</td>
                          <td className="py-3.5 px-4 font-semibold text-primary">
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0
                            }).format(item.total_simpanan)}
                          </td>
                          <td className="py-3.5 px-4 font-medium">{item.suku_bunga}%</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm ${
                              isEligible
                                ? "bg-success/10 text-success border border-success/20"
                                : "bg-error/10 text-error border border-error/20"
                            }`}>
                              {isEligible ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Dijamin
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  Tidak Dijamin
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right opacity-70">
                            {new Date(item.created_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short"
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Animated Chat Widget (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen ? (
          <div className="bg-card w-80 md:w-96 h-[450px] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden transition-all duration-300 transform scale-100 origin-bottom-right">
            {/* Chat Header */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Asisten LPS</h4>
                  <span className="text-[10px] opacity-75">Dukungan Online</span>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)} 
                className="hover:bg-white/10 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-secondary/10">
              {chatMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs md:text-sm leading-relaxed ${
                      msg.sender === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-secondary text-secondary-foreground rounded-tl-none border border-border"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary text-secondary-foreground px-3.5 py-2 rounded-2xl rounded-tl-none border border-border flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border flex gap-2 bg-card">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tanya LPS Smart-Assistant..."
                className="flex-1 px-3 py-2 border border-border rounded-xl bg-input text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="bg-primary text-primary-foreground p-2 rounded-xl hover:opacity-95 disabled:opacity-50 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setIsChatOpen(true)}
            className="bg-primary text-primary-foreground p-4 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 flex items-center justify-center border border-primary/20 animate-bounce"
            title="Tanya LPS Assistant"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Evaluation Outcome Modal Overlay */}
      {isModalOpen && modalResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border transform scale-100 transition-all duration-300">
            {/* Modal Top Visual Banner */}
            <div className={`p-6 text-center text-white ${modalResult.is_guaranteed ? 'bg-success' : 'bg-error'}`}>
              {modalResult.is_guaranteed ? (
                <CheckCircle2 className="w-16 h-16 mx-auto mb-2" />
              ) : (
                <XCircle className="w-16 h-16 mx-auto mb-2" />
              )}
              <h4 className="text-xl font-bold tracking-wide">
                {modalResult.is_guaranteed ? "Simpanan Dijamin LPS!" : "Simpanan TIDAK Dijamin LPS"}
              </h4>
            </div>

            {/* Modal Details Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs border-b border-border pb-2">
                  <span className="opacity-70">Nama Nasabah:</span>
                  <span className="font-bold">{customerName || "-"}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-border pb-2">
                  <span className="opacity-70">Nama Bank:</span>
                  <span className="font-bold">{bankName || "-"}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-border pb-2">
                  <span className="opacity-70">Total Simpanan:</span>
                  <span className="font-bold text-primary">{formatCurrency(balance)}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-border pb-2">
                  <span className="opacity-70">Suku Bunga:</span>
                  <span className="font-bold">{interestRate}%</span>
                </div>
              </div>

              {!modalResult.is_guaranteed && modalResult.reason && (
                <div className="p-4 bg-error/10 border border-error/20 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-error uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Penyebab Tidak Dijamin:
                  </span>
                  <p className="text-xs text-foreground leading-relaxed opacity-90">
                    {modalResult.reason}
                  </p>
                </div>
              )}

              {modalResult.is_guaranteed && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-xl text-xs text-success leading-relaxed">
                  Selamat! Seluruh kriteria 3T terpenuhi secara legal. Simpanan Anda aman dilindungi oleh Lembaga Penjamin Simpanan (LPS) sesuai batas limit penjaminan.
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleDownloadCertificate}
                  disabled={pdfLoading}
                  className="w-full bg-primary hover:opacity-90 text-primary-foreground font-bold py-2.5 rounded-xl transition duration-200 text-xs flex items-center justify-center gap-2"
                >
                  {pdfLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Mengunduh...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-3.5 h-3.5" />
                      Download Sertifikat PDF
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2.5 rounded-xl transition duration-200 text-xs"
                >
                  Tutup Hasil Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
