import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Search, 
  Camera, 
  Copy, 
  Check, 
  ChevronDown, 
  Menu, 
  X, 
  ArrowRight, 
  AlertTriangle,
  UserCheck,
  Building2,
  CheckCircle2,
  FlaskConical
} from 'lucide-react';
import QrScanner from 'qr-scanner';
import { 
  DEMO_CERT_VALID, 
  DEMO_CERT_EXPIRED, 
  DEMO_CERT_REVOKED,
  parseVerifyInput 
} from '../../../shared/index.js';
import { get, post } from '../lib/api';
import { JudgesLabDrawer } from '../components/JudgesLabDrawer';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { Toast } from '../components/ui/Toast';

export const Home = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  // Verification code input
  const [code, setCode] = useState('');
  const [inputError, setInputError] = useState('');
  
  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // QR Modal & Camera state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalInput, setQrModalInput] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanError, setScanError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Config: demoMode
  const [demoMode, setDemoMode] = useState<boolean>(true);

  // FAQ open states
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [labOpen, setLabOpen] = useState(false);

  useEffect(() => {
    // Fetch system configuration
    get<{ demoMode: boolean }>('/api/config')
      .then(res => setDemoMode(res.demoMode))
      .catch(() => setDemoMode(true));
  }, []);

  // Initialize and tear down QR Scanner
  useEffect(() => {
    if (!qrModalOpen) {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      setCameraError('');
      setScanError('');
      return;
    }

    const timer = setTimeout(() => {
      if (videoRef.current) {
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const parsed = parseVerifyInput(result.data, window.location.origin);
            if (parsed) {
              scanner.stop();
              scanner.destroy();
              qrScannerRef.current = null;
              setQrModalOpen(false);
              navigate(`/v/${parsed}`);
            } else {
              setScanError('Scanned QR code does not belong to a valid NISHCHAY verification link.');
            }
          },
          {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        qrScannerRef.current = scanner;
        scanner.start().catch(() => {
          setCameraError('Camera access is unavailable or was denied. You can enter the certificate code manually below.');
        });
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
    };
  }, [qrModalOpen, navigate]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError('');
    const parsedId = parseVerifyInput(code, window.location.origin);
    if (!parsedId) {
      setInputError('Please enter a valid certificate code (e.g. sample-cert-val1d-0000) or verification link.');
      return;
    }
    navigate(`/v/${parsedId}`);
  };

  const handleModalVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    const parsedId = parseVerifyInput(qrModalInput, window.location.origin);
    if (!parsedId) {
      setScanError('Please enter a valid certificate code or verification link.');
      return;
    }
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setQrModalOpen(false);
    navigate(`/v/${parsedId}`);
  };

  const copyToClipboard = async (text: string) => {
    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        // fallback
      }
    }
    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        success = false;
      }
    }
    if (success) {
      setCopiedCode(text);
      setToastMessage(`Copied ${text} to clipboard`);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleDemoLogin = async (role: 'BUSINESS' | 'LMO' | 'GATC' | 'ADMIN') => {
    try {
      await post(`/api/demo/login-as/${role}`, {});
      await refresh();
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo sign in failed';
      setToastMessage(msg);
    }
  };

  const sampleCertificates = [
    { code: DEMO_CERT_VALID, status: 'Valid' as const, label: 'Standard Weights' },
    { code: DEMO_CERT_EXPIRED, status: 'Expired' as const, label: 'Counter Machine' },
    { code: DEMO_CERT_REVOKED, status: 'Revoked' as const, label: 'NAWI Class III' },
  ];

  const faqs = [
    {
      q: 'What is Legal Metrology?',
      a: 'Legal Metrology regulates weighing and measuring instruments used in trade, commerce, and public transactions. It enforces standards to guarantee measurement accuracy, protect consumers against short deliveries, and ensure honest commercial competition.'
    },
    {
      q: 'What is a GATC?',
      a: 'A Government Approved Test Centre (GATC) is an authorized verification facility under the Legal Metrology regime. GATCs verify specific categories of commercial instruments, such as non-automatic weighing instruments (NAWI), according to prescribed statutory rules.'
    },
    {
      q: 'Is this a real government system?',
      a: 'No. NISHCHAY is an engineering prototype built for Smart India Hackathon problem statement SIH26036 (Department of Consumer Affairs). All data, businesses, officer identities, and certificates within this prototype are synthetic.'
    },
    {
      q: 'Is the payment real?',
      a: 'No. All statutory fees, payments, and e-receipts operate within a simulated sandbox environment. No real funds or banking networks are involved.'
    },
    {
      q: 'What does the QR contain?',
      a: 'The physical QR code contains only the direct public verification URL (/v/{id}). It does not contain unencrypted officer personal data, raw GPS coordinates, or confidential inspection notes.'
    },
    {
      q: 'What can I check without an account?',
      a: 'Anyone can check an instrument\'s verification status, category, serial number, validity period, issuing authority, and cryptographic seal integrity in their browser. Consumers can also submit a Right to Check inquiry without signing in.'
    }
  ];

  return (
    <div className="min-h-screen bg-gauge-steel text-ink flex flex-col font-sans">
      
      {/* Toast notification */}
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          type="success" 
          onClose={() => setToastMessage('')} 
          duration={3000} 
        />
      )}

      {/* 1. Sticky Top Navigation */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded">
            <div className="w-8 h-8 rounded bg-calibration-blue flex items-center justify-center text-white font-bold text-lg font-heading">
              N
            </div>
            <div>
              <span className="font-heading font-bold text-ink text-lg tracking-tight">NISHCHAY</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-gray-500 font-sans">Legal Metrology</span>
            </div>
          </Link>

          {/* Desktop Nav Anchors */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button 
              type="button"
              onClick={() => scrollToSection('how-it-works')} 
              className="text-gray-600 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded px-1 py-0.5"
            >
              How it works
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('verify')} 
              className="text-gray-600 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded px-1 py-0.5"
            >
              Verify
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('for-businesses')} 
              className="text-gray-600 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded px-1 py-0.5"
            >
              For businesses
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('for-officers')} 
              className="text-gray-600 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded px-1 py-0.5"
            >
              For officers
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('faq')} 
              className="text-gray-600 hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded px-1 py-0.5"
            >
              FAQ
            </button>
            {demoMode && (
              <button
                type="button"
                data-testid="home-judges-lab-button"
                onClick={() => setLabOpen(true)}
                className="px-3 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FlaskConical className="w-4 h-4 text-purple-700" />
                <span>Judge's Lab</span>
              </button>
            )}
            <Link to="/login">
              <Button variant="outline" size="sm">Sign in</Button>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-ink focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-200 px-4 pt-2 pb-4 space-y-2">
            {demoMode && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLabOpen(true);
                }}
                className="w-full text-left py-2 px-3 text-purple-900 bg-purple-50 hover:bg-purple-100 rounded text-sm font-bold flex items-center gap-2 mb-1"
              >
                <FlaskConical className="w-4 h-4 text-purple-700" />
                <span>Judge's Lab &amp; Guide</span>
              </button>
            )}
            <button 
              type="button"
              onClick={() => scrollToSection('how-it-works')} 
              className="block w-full text-left py-2 px-3 text-base text-gray-700 hover:bg-gray-50 rounded"
            >
              How it works
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('verify')} 
              className="block w-full text-left py-2 px-3 text-base text-gray-700 hover:bg-gray-50 rounded"
            >
              Verify
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('for-businesses')} 
              className="block w-full text-left py-2 px-3 text-base text-gray-700 hover:bg-gray-50 rounded"
            >
              For businesses
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('for-officers')} 
              className="block w-full text-left py-2 px-3 text-base text-gray-700 hover:bg-gray-50 rounded"
            >
              For officers
            </button>
            <button 
              type="button"
              onClick={() => scrollToSection('faq')} 
              className="block w-full text-left py-2 px-3 text-base text-gray-700 hover:bg-gray-50 rounded"
            >
              FAQ
            </button>
            <div className="pt-2 border-t border-gray-100">
              <Link to="/login" className="block w-full" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">Sign in</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-24 w-full">
        
        {/* 2. Hero Section: Two Columns */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT: Plain headline and explanation */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1 text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-ink tracking-tight leading-tight">
              Check a weighing instrument certificate in seconds
            </h1>
            
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
              Weighing and measuring instruments used in trade must be verified by the Legal Metrology department to ensure accuracy and fair commerce. This prototype demonstrates how that verification can be proven to anyone with a QR code and an in-browser cryptographic seal check.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="inline-flex items-center gap-2 text-calibration-blue font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded py-1 px-2"
              >
                <span>See how it works</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick stats or benefits */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-200">
              <div className="bg-white p-4 rounded border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Tamper Evident</div>
                <div className="text-sm font-semibold text-ink mt-1">ECDSA P-256 seal verified in browser</div>
              </div>
              <div className="bg-white p-4 rounded border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Field Verified</div>
                <div className="text-sm font-semibold text-ink mt-1">Geo-tagged GPS location and photo</div>
              </div>
              <div className="bg-white p-4 rounded border border-gray-200">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Fee-Gated</div>
                <div className="text-sm font-semibold text-ink mt-1">Locked e-receipt required for issue</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Verify Card (sticky on desktop, prominent on mobile) */}
          <div id="verify" className="lg:col-span-5 order-1 lg:order-2 lg:sticky lg:top-24">
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-6 sm:p-7 space-y-6 text-left">
              <div>
                <h2 className="text-xl font-heading font-bold text-ink">Verify a certificate</h2>
                <p className="text-sm text-gray-600 mt-1">Enter a certificate identifier, paste a verification link, or scan a physical QR code.</p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="verify-code-input" className="block text-sm font-semibold text-ink mb-1.5">
                    Certificate code or URL
                  </label>
                  <Input 
                    id="verify-code-input"
                    name="certificateCode"
                    autoComplete="off"
                    placeholder="e.g. sample-cert-val1d-0000" 
                    value={code} 
                    onChange={e => {
                      setCode(e.target.value);
                      if (inputError) setInputError('');
                    }}
                    error={Boolean(inputError)}
                    className="font-mono text-sm sm:text-base tracking-wide"
                  />
                  {inputError && (
                    <p className="text-xs text-seal-break-red mt-1 font-medium">{inputError}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" variant="primary" className="flex-1 gap-2">
                    <Search className="w-4 h-4" />
                    <span>Check certificate</span>
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setScanError('');
                      setCameraError('');
                      setQrModalInput('');
                      setQrModalOpen(true);
                    }}
                    className="gap-2 shrink-0"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan QR</span>
                  </Button>
                </div>
              </form>

              {/* Sample Certificates (Demo Data) */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Sample certificates (demo data)
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  {sampleCertificates.map(sample => (
                    <div 
                      key={sample.code} 
                      className="flex items-center justify-between p-2.5 rounded bg-gray-50 border border-gray-200 gap-2"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="font-mono text-xs text-ink truncate font-medium">
                          {sample.code}
                        </span>
                        <StatusChip status={sample.status} />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sample.code)}
                          aria-label={`Copy certificate code ${sample.code}`}
                          className="p-1.5 text-gray-500 hover:text-ink hover:bg-gray-200 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-calibration-blue"
                          title="Copy code"
                        >
                          {copiedCode === sample.code ? (
                            <Check className="w-4 h-4 text-verified-green" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          aria-label={`Check sample certificate ${sample.code}`}
                          onClick={() => navigate(`/v/${sample.code}`)}
                          className="py-1 px-2.5 min-h-[32px] text-xs"
                        >
                          Check
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. "How a certificate is earned" Section */}
        <section id="how-it-works" className="space-y-8 text-left scroll-mt-20">
          <div>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-ink">How a certificate is earned</h2>
            <p className="text-gray-600 mt-2 max-w-3xl text-sm sm:text-base">
              Every certificate in NISHCHAY passes through a six-step statutory workflow ensuring lawful verification and non-repudiation.
            </p>
          </div>

          {/* Six Step Tick-Scale Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3 relative">
              <div className="w-8 h-8 rounded-full bg-calibration-blue text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-heading font-bold text-ink text-lg">Register</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                The business registers their profile, trade premises address, and weighing instruments with model and class details.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3 relative">
              <div className="w-8 h-8 rounded-full bg-calibration-blue text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-heading font-bold text-ink text-lg">Apply and pay</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                The statutory verification fee is snapshotted based on the instrument class. An HMAC-secured e-receipt is generated upon payment.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3 relative">
              <div className="w-8 h-8 rounded-full bg-calibration-blue text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-heading font-bold text-ink text-lg">Officer inspects on site</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                The assigned officer arrives at the premises, records GPS coordinates within radius, and captures a live inspection photo.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3 relative">
              <div className="w-8 h-8 rounded-full bg-calibration-blue text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <h3 className="font-heading font-bold text-ink text-lg">Certificate with a seal</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Upon passing tolerances, an ECDSA P-256 seal is generated, hashing the checklist, readings, photo digests, and fee receipt.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3 relative">
              <div className="w-8 h-8 rounded-full bg-calibration-blue text-white flex items-center justify-center font-bold text-sm">
                5
              </div>
              <h3 className="font-heading font-bold text-ink text-lg">Anyone can verify</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Traders and consumers scan the QR code on the physical seal to inspect the public record and verify the signature in their browser.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-3 relative">
              <div className="w-8 h-8 rounded-full bg-calibration-blue text-white flex items-center justify-center font-bold text-sm">
                6
              </div>
              <h3 className="font-heading font-bold text-ink text-lg">Right to Check</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Anyone encountering a suspicious or defective instrument can file an immediate anonymous report linked to the certificate record.
              </p>
            </div>
          </div>

          {/* Sample Verification Plate Component */}
          <div className="bg-white rounded-lg border border-gray-300 p-6 sm:p-8 space-y-6">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Component preview</div>
              <h3 className="text-xl font-heading font-bold text-ink mt-1">The Verification Plate</h3>
              <p className="text-sm text-gray-600 mt-1">
                Every verified certificate presents four live data-driven trust ticks and browser cryptographic verification.
              </p>
            </div>

            <div className="max-w-md mx-auto rounded-lg overflow-hidden border border-emerald-700 shadow-md">
              {/* Solid Plate Header */}
              <div className="bg-verified-green text-white p-6 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-heading font-extrabold tracking-wide">VALID</div>
                  <div className="font-mono text-xs opacity-90 mt-1">sample-cert-val1d-0000</div>
                </div>

                {/* The 4 ticks */}
                <div className="bg-black/20 rounded p-4 text-left space-y-2.5 text-xs text-white">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span><strong>Fee receipt:</strong> Official statutory fee cryptographically locked.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span><strong>Officer on site:</strong> Physical GPS location recorded within range.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span><strong>Checklist recorded:</strong> Statutory tolerances and visual tests stored.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span><strong>Seal intact:</strong> Record hash matches the cryptographic signature.</span>
                  </div>
                </div>
              </div>

              {/* Verified in your browser note */}
              <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between text-xs text-emerald-900 font-medium">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-verified-green" />
                  <span>Verified in your browser</span>
                </div>
                <span className="font-mono text-gray-500">Key: c307b510</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. "What the seal proves, and what it does not" */}
        <section className="bg-white rounded-lg border border-gray-300 p-6 sm:p-8 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-heading font-bold text-ink">What the seal proves, and what it does not</h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              A transparent metrology platform must clearly distinguish between mathematical integrity and human verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-verified-green font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>What the seal proves</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-2 pl-7 list-disc">
                <li>The cryptographic seal proves that the digital record has not been altered after it was captured and signed by the issuing authority.</li>
                <li>The official fee transaction was cryptographically locked and matched prior to certificate issuance.</li>
                <li>The physical inspection photos, readings, and tolerance tests correspond to the stored SHA-256 digests.</li>
              </ul>
            </div>

            <div className="p-5 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 text-[#8A5A00] font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>What the seal does not prove</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-2 pl-7 list-disc">
                <li>The seal proves a record was not altered after capture. It does not prove the original observations were true.</li>
                <li>The fee-gate removes the officer's control over the official fee transaction. It does not stop off-book payments.</li>
                <li>Selective disclosure: sensitive private details (officer identity, raw GPS, and internal checklist notes) remain confidential and are protected by cryptographic digests rather than open exposure.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. "For businesses" and "For officers and administrators" */}
        <section className="space-y-6 text-left">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* For businesses panel */}
            <div id="for-businesses" className="bg-white rounded-lg border border-gray-300 p-6 sm:p-8 space-y-5 flex flex-col justify-between scroll-mt-20">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded bg-blue-50 text-calibration-blue flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-heading font-bold text-ink">For businesses</h2>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Indian commercial establishments operating weighing instruments, counter machines, or measuring devices can manage compliance online.
                </p>
                <ul className="text-sm text-gray-700 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-calibration-blue shrink-0" />
                    <span>Register instruments and maintain premises equipment profiles</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-calibration-blue shrink-0" />
                    <span>Apply for statutory verification and pay official fees online</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-calibration-blue shrink-0" />
                    <span>Download signed verification certificates and e-receipts</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 flex flex-wrap gap-3">
                <Link to="/register">
                  <Button variant="primary">Register business</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline">Sign in to business portal</Button>
                </Link>
              </div>
            </div>

            {/* For officers and administrators panel */}
            <div id="for-officers" className="bg-white rounded-lg border border-gray-300 p-6 sm:p-8 space-y-5 flex flex-col justify-between scroll-mt-20">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded bg-blue-50 text-calibration-blue flex items-center justify-center">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-heading font-bold text-ink">For officers and administrators</h2>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Dedicated workflows for Legal Metrology Officers (LMO) and Government Approved Test Centres (GATC).
                </p>
                <ul className="text-sm text-gray-700 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-calibration-blue shrink-0" />
                    <span>Review assigned inspection schedules within your district zone</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-calibration-blue shrink-0" />
                    <span>Record geo-tagged site arrival, live photos, and metric readings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-calibration-blue shrink-0" />
                    <span>Issue digitally signed, tamper-evident certificates with ECDSA seal</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4">
                <Link to="/login">
                  <Button variant="outline">Sign in to officer portal</Button>
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* 6. "Explore the prototype" (when demoMode is true) */}
        {demoMode && (
          <section className="bg-white rounded-lg border-2 border-calibration-blue p-6 sm:p-8 space-y-5 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-calibration-blue text-white mb-1">
                  DEMO MODE
                </span>
                <h2 className="text-2xl font-heading font-bold text-ink">Explore the prototype</h2>
              </div>
              <p className="text-sm text-gray-600 sm:max-w-md">
                One-click switch between the four seeded roles. Opens directly into the active dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleDemoLogin('BUSINESS')}
                className="justify-between px-4 py-3"
              >
                <span>Business</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleDemoLogin('LMO')}
                className="justify-between px-4 py-3"
              >
                <span>Legal Metrology Officer</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleDemoLogin('GATC')}
                className="justify-between px-4 py-3"
              >
                <span>Test Centre</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleDemoLogin('ADMIN')}
                className="justify-between px-4 py-3"
              >
                <span>Administrator</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </section>
        )}

        {/* 7. FAQ Accordion */}
        <section id="faq" className="bg-white rounded-lg border border-gray-300 p-6 sm:p-8 space-y-6 text-left scroll-mt-20">
          <div>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-ink">Frequently asked questions</h2>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Common questions about Legal Metrology verification, certificate security, and prototype features.
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="w-full text-left font-semibold text-ink flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-calibration-blue rounded p-1"
                  >
                    <span className="text-base sm:text-lg">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="mt-3 text-sm sm:text-base text-gray-700 leading-relaxed pr-6">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* QR Scanner Camera Modal */}
      <Modal 
        isOpen={qrModalOpen} 
        onClose={() => setQrModalOpen(false)} 
        title="Scan certificate QR code"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-gray-600">
            Point your camera at the QR code on the instrument or physical verification certificate.
          </p>

          <div className="relative rounded overflow-hidden bg-black aspect-video flex items-center justify-center">
            <video 
              ref={videoRef} 
              className="w-full h-full object-cover" 
              playsInline 
              muted 
            />
            {cameraError && (
              <div className="absolute inset-0 bg-gray-900/90 p-4 text-center flex flex-col items-center justify-center text-xs text-white space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <p>{cameraError}</p>
              </div>
            )}
          </div>

          {scanError && (
            <p className="text-xs text-seal-break-red font-medium">{scanError}</p>
          )}

          {/* Typing always works inside the modal */}
          <form onSubmit={handleModalVerify} className="space-y-2 pt-2 border-t border-gray-100">
            <label htmlFor="modal-code-input" className="block text-xs font-semibold text-gray-700">
              Or enter certificate code or verification link
            </label>
            <div className="flex gap-2">
              <Input 
                id="modal-code-input"
                name="modalCode"
                autoComplete="off"
                placeholder="e.g. sample-cert-val1d-0000"
                value={qrModalInput}
                onChange={e => setQrModalInput(e.target.value)}
                className="font-mono text-xs flex-1"
              />
              <Button type="submit" size="sm" variant="primary">Verify</Button>
            </div>
          </form>

          <div className="pt-2 flex justify-end">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => setQrModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Prototype notice and Footer */}
      <footer className="w-full mt-16 py-8 border-t border-gray-200 bg-white text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-ink">Prototype built for SIH26036. Not an official government system.</p>
          <p>All data synthetic. Verified under the Legal Metrology (General) Rules.</p>
          <p className="text-gray-600 pt-1">Department of Consumer Affairs, Government of India problem statement.</p>
        </div>
      </footer>

      <JudgesLabDrawer isOpen={labOpen} onClose={() => setLabOpen(false)} />
    </div>
  );
};
