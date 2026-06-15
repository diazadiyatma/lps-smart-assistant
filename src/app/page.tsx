"use client";

import { useState } from "react";
import axios from "axios";
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
  Image as ImageIcon
} from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);

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
      const response = await axios.post("http://localhost:8000/api/v1/calculate", {
        customer_name: customerName,
        bank_name: bankName,
        total_balance: parseFloat(balance),
        interest_rate: parseFloat(interestRate),
        is_recorded: isRecorded,
        is_not_harmful: isNotHarmful,
      });

      setModalResult(response.data);
      setIsModalOpen(true);
    } catch (err: any) {
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map((d: any) => d.msg).join(", "));
        } else {
          setError("Failed to run verification logic. Please check the inputs.");
        }
      } else {
        setError("Could not connect to the backend verification service. Please make sure the backend is running on port 8000.");
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
    
    // Set preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const formData = new FormData();
    formData.append("file", file);

    setScanLoading(true);
    setScanError(null);

    try {
      const response = await axios.post("http://localhost:8000/api/v1/scan-document", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      const { extracted_balance, extracted_interest_rate, raw_text } = response.data;
      
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
      
      if (extracted_balance === null && extracted_interest_rate === null) {
        setScanError("OCR succeeded, but no balance or interest rate formats could be matched. Please fill manually.");
      }
    } catch (err: any) {
      setScanError(err.response?.data?.detail || "Failed to parse document. Make sure image is clear and OCR.space token is configured.");
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
      const response = await axios.post("http://localhost:8000/api/v1/chat", {
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

  return (
    <main className="min-h-screen bg-background text-foreground transition-colors duration-300 relative">
      {/* Premium Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-primary/10 border border-primary/20">
              <img src="/logo.png" alt="LPS Smart-Assistant Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LPS Smart-Assistant</h1>
              <p className="text-xs text-muted-foreground opacity-70">Intelligent 3T Calculator & Compliance Audit</p>
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
          </div>
        </div>
      </header>

      {/* Main Content (Bento Grid Layout) */}
      <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Banner Row */}
          <div className="lg:col-span-12 glow-card bg-card p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="max-w-2xl">
              <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-3 py-1 rounded-full">Indonesian Deposit Insurance Corporation Guidelines</span>
              <h2 className="text-2xl font-bold mt-2 tracking-tight">Does your deposit meet the 3T Criteria?</h2>
              <p className="text-sm mt-1 text-muted-foreground leading-relaxed opacity-80">
                To guarantee your deposit up to <strong>Rp 2,000,000,000</strong>, the Indonesian Deposit Insurance Corporation (LPS) mandates compliance check across three core pillars.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
              {["Tercatat", "Tepat Bunga", "Tidak Merugikan"].map((rule, idx) => (
                <div key={idx} className="bg-secondary/50 border border-border rounded-xl p-3 text-center">
                  <p className="text-xs font-bold text-primary">Pillar {idx + 1}</p>
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
                <h3 className="text-lg font-bold">3T Verification Form</h3>
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
                    <User className="w-3.5 h-3.5" /> Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm"
                  />
                </div>

                {/* Bank Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Bank Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bank Mandiri"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm"
                  />
                </div>

                {/* Total Account Balance */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" /> Total Account Balance
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="e.g. 100000000"
                      value={balance}
                      onChange={(e) => setBalance(e.target.value)}
                      className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm"
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
                    <Percent className="w-3.5 h-3.5" /> Bank Interest Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g. 3.75"
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring transition duration-200 text-sm"
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
                    <strong>T1:</strong> Is your deposit officially recorded in the bank ledger?
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
                    <strong>T3:</strong> Are you completely free from any actions that caused harm to the bank?
                  </label>
                </div>

                {/* Actions */}
                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:opacity-90 disabled:opacity-50 transition duration-200 flex items-center justify-center gap-2 text-sm shadow-md"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      "Verify Deposit Insurance Status"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-3 rounded-xl border border-border hover:bg-secondary transition duration-200"
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
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">OCR Scan</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  Upload an image scan of your savings book page or statement. Our AI system will extract balances and interest rates instantly.
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
                  {scanLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-[10px] font-semibold">Parsing details...</span>
                    </div>
                  ) : previewUrl ? (
                    <div className="flex flex-col items-center text-center gap-2 w-full h-full">
                      <img 
                        src={previewUrl} 
                        alt="Pratinjau dokumen" 
                        className="max-h-24 max-w-full object-contain rounded-lg border border-border shadow-sm" 
                      />
                      <span className="text-xs font-bold text-primary flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Ubah Dokumen
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs font-bold">Upload Bank Book</span>
                      <span className="text-[10px] text-muted-foreground">PNG, JPG, or WEBP</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-primary" /> Max file size: 5MB
                </span>
              </div>
            </div>

          </div>

          {/* Grid Box: Capping / Guidelines Widget (Col Span 4) */}
          <div className="lg:col-span-4 glow-card bg-card p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
                <h3 className="text-lg font-bold">LPS Protection Capping</h3>
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-xs text-muted-foreground">Max Covered Balance</p>
                  <p className="text-2xl font-bold tracking-tight text-primary mt-1">Rp 2.000.000.000</p>
                </div>
                
                <div className="p-4 bg-secondary/50 rounded-xl">
                  <p className="text-xs text-muted-foreground">Max Covered Interest Rate</p>
                  <p className="text-2xl font-bold tracking-tight text-primary mt-1">4.25% <span className="text-xs font-normal text-muted-foreground">(IDR)</span></p>
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
                  <h4 className="font-bold text-sm">LPS Assistant</h4>
                  <span className="text-[10px] opacity-75">Online Support</span>
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

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold py-2.5 rounded-xl transition duration-200 text-xs"
              >
                Tutup Hasil Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
