import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Landing({ navigate }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const [activeScenario, setActiveScenario] = useState('dropoff');

  const scenarios = [
    { id: 'dropoff', title: 'Checkout Drop-off' },
    { id: 'degradation', title: 'Payment Degradation' },
    { id: 'subscription', title: 'Subscription Failure' },
    { id: 'b2b', title: 'B2B Receivables' },
    { id: 'mandate', title: 'NACH Mandate Retry' },
    { id: 'voice', title: 'Voice Recovery' },
    { id: 'ptp', title: 'PTP Commitment' },
  ];

  const scenarioDetails = {
    dropoff: {
      headline: 'Recover abandoned carts before they go cold.',
      desc: 'Customer reached checkout but didn\'t complete payment. Retrek sends a personalized recovery link within minutes, not hours.',
      points: [
        'Triggered on checkout.session.expired or payment.failed at checkout',
        'Recovery link sent via SMS/WhatsApp with contextual messaging',
        '3-attempt retry cadence with escalating urgency',
        'Typical recovery window: 15–60 minutes post-abandonment',
      ],
    },
    degradation: {
      headline: 'Retry failed payments with intelligent routing.',
      desc: 'Standard payment failure — expired card, insufficient funds, or bank timeout. Retrek diagnoses the root cause and retries with a new payment link.',
      points: [
        'Maps decline codes to 16 ISO-8583 banking ontology categories',
        'Groq LLM generates context-aware Hinglish recovery messages',
        'Auto-execute for low-value, high-probability recoveries',
        'Per-scenario retry limits prevent customer fatigue',
      ],
    },
    subscription: {
      headline: 'Prevent service interruption for recurring payments.',
      desc: 'Subscription payment failed due to card expiry, limit exceeded, or NACH mandate issue. Retrek proactively reaches out before the service lapses.',
      points: [
        'Proactive outreach before subscription grace period ends',
        'Card update link or alternate payment method suggestion',
        '4-retry cadence aligned with billing cycle',
        'Reduces involuntary churn from failed recurring charges',
      ],
    },
    b2b: {
      headline: 'Chase overdue enterprise invoices without burning bridges.',
      desc: 'B2B receivables past due date. Retrek sends formal, professional reminders with escalating tone while preserving the business relationship.',
      points: [
        '5-retry cadence with formal-to-urgent tone escalation',
        'Higher auto-execute threshold (₹50k) for trusted vendors',
        'Vendor trust scoring based on past payment success count',
        'Audit trail for compliance and dispute resolution',
      ],
    },
    mandate: {
      headline: 'Retry failed NACH e-mandates automatically.',
      desc: 'NACH auto-debit failed due to insufficient balance or bank rejection. Retrek schedules retries aligned with the customer\'s likely cash flow.',
      points: [
        '5-retry cadence with smart interval scheduling',
        'Scheduler polls for next_retry_at and re-runs pipeline',
        'Customer notified via preferred channel each attempt',
        'Aligns retry timing with salary credit cycles',
      ],
    },
    voice: {
      headline: 'Speakable recovery scripts for phone-based collections.',
      desc: 'Customer is on a live call. Retrek generates a concise, speakable recovery script that the agent can read verbatim to guide the customer to payment.',
      points: [
        '2-retry limit to prevent call fatigue',
        'LLM generates natural, conversational Hinglish scripts',
        'Script includes amount, reason, and 1-click payment link',
        'Designed for collection agents and customer support teams',
      ],
    },
    ptp: {
      headline: 'Follow up when a promise-to-pay date arrives.',
      desc: 'Customer committed to paying on a specific date. Retrek checks the PTP date and re-runs the recovery pipeline when it arrives.',
      points: [
        'Scheduler checks ptp_date daily and triggers pipeline on due date',
        '2-retry limit — stops if ptp_date is still in the future',
        'Personalized reminder referencing the original commitment',
        'Full audit log of promise-to-pay lifecycle',
      ],
    },
  };

  // Scroll-reveal animations (fires once per element)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      document.querySelectorAll('[data-reveal], [data-reveal-child]').forEach(el => {
        el.classList.add('revealed');
      });
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add('revealed');
            el.querySelectorAll('[data-reveal-child]').forEach((child, i) => {
              child.style.transitionDelay = `${50 + i * 80}ms`;
              child.classList.add('revealed');
            });
            obs.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));
    document.querySelectorAll('[data-reveal]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        el.classList.add('revealed');
        el.querySelectorAll('[data-reveal-child]').forEach((child, i) => {
          child.style.transitionDelay = `${50 + i * 80}ms`;
          child.classList.add('revealed');
        });
        obs.unobserve(el);
      }
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#fbfaf6] text-[#0f172a] antialiased overflow-x-hidden selection:bg-[#174f43] selection:text-white">

      {/* GLOBAL WRAPPER FOR VERTICAL LINES */}
      <div className="max-w-[1440px] mx-auto border-x border-slate-200 min-h-screen relative bg-[#fbfaf6]">

        {/* NAVBAR */}
        <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200">
          <div className="h-12 flex items-center">

            {/* Logo Section */}
            <div className="flex items-center h-full px-6 border-r border-slate-200 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/logo.png" alt="Retrek" className="h-8 w-auto mr-2" />
              <span className="font-semibold text-lg tracking-tight text-[#0f172a]">Retrek</span>
            </div>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex h-full items-center text-sm font-normal text-slate-600">
              <a href="#problem" className="h-full px-6 flex items-center border-r border-slate-200 hover:text-black transition-colors">Problem</a>
              <a href="#how-it-works" className="h-full px-6 flex items-center border-r border-slate-200 hover:text-black transition-colors">How it works</a>
              <a href="#scenarios" className="h-full px-6 flex items-center border-r border-slate-200 hover:text-black transition-colors">Use cases</a>
            </nav>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Right CTA */}
            <div className="h-full hidden md:flex">
              <button
                onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                className="h-full px-8 bg-[#174f43] hover:bg-[#143f36] text-white text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                Open workspace <span className="text-lg leading-none mt-[-2px]">›</span>
              </button>
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden px-4 h-full border-l border-slate-200 cursor-pointer"
            >
              ☰
            </button>
          </div>
        </header>

        {/* SECTION 1: HERO */}
        <section className="bg-[#fbfaf6] pt-4 pb-16 px-6 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[calc(100vh-48px)]">
          {/* Left Column */}
          <div>
            <div className="inline-block bg-[#174f43] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 mb-6">
              AUTONOMOUS REVENUE RECOVERY
            </div>
            <h1 className="text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] font-medium tracking-tighter text-[#0f172a] leading-[0.9] -ml-1">
              The bank
              already knows. <br />
              <span className="text-[#174f43]">Nobody can act <br /> in time.</span>
            </h1>
          </div>

          {/* Right Column */}
          <div className="lg:pt-16 flex flex-col justify-start max-w-lg">
            <p className="text-lg text-slate-600 leading-relaxed mb-4">
              A payment gateway already owns the answer to almost every failed transaction it has. The answer is buried across opaque error codes, timeout pings, and risk flags that do not talk to each other.
            </p>
            <p className="text-lg text-[#0f172a] font-medium leading-relaxed mb-6">
              <strong>Retrek reads all of it into one system</strong> that diagnoses root causes in real-time and dispatches a personalized 1-click recovery link. When the evidence is thin on a fraud check, it refuses rather than guesses.
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-[#174f43] hover:bg-[#143f36] text-white px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
              >
                Watch demo <span className="text-lg leading-none mt-[-2px]">›</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* SECTION 2: THE PROBLEM */}
      <section id="problem" data-reveal className="bg-white">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-12 py-12 lg:py-16">

          <div className="mb-8 max-w-2xl">
            <span data-reveal-child className="inline-block bg-[#174f43] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 mb-6">
              The Problem
            </span>
            <h2 data-reveal-child className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-[#0f172a] leading-[1.1] mb-4">
              This is not a gateway problem.<br />
              <span className="text-[#174f43]">It is a revenue problem.</span>
            </h2>
            <p data-reveal-child className="text-slate-500 text-[15px] leading-relaxed">
              Payment gateways are built for authorization, not recovery. When an OTP times out or a card degrades, static retry rules do nothing. The customer leaves, the money leaks, and nobody notices until month-end reconciliation.
            </p>
          </div>

          <div data-reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
            {[
              {
                stat: '70%',
                headline: 'cart abandonment from payment failures',
                desc: 'Nearly 70% of cart abandonment in India happens due to payment failures, not shipping costs or indecision. The payment itself breaks.',
                source: 'RAZORPAY, 2026',
                url: 'https://razorpay.com/blog/payment-success-rate-optimization-india/' // 1. Add your link here
              },
              {
                stat: '4.8M',
                headline: 'failed UPI transactions per day',
                desc: 'Even at a 0.8% technical decline rate on 600M+ daily UPI transactions, that is 4.8 million failed moments of trust every single day.',
                source: 'NPCI, FY 2024-25',
                url: 'https://www.npci.org.in/product/upi/product-statistics'
              },
              {
                stat: '62%',
                headline: 'of customers never return',
                desc: '62% of users who encounter a payment error never return to the site. You lose the order and the entire customer lifetime value.',
                source: 'CLEVERBRIDGE',
                url: 'https://grow.cleverbridge.com/blog/failed-payment-recovery-dynamic-retries'
              },
              {
                stat: '85L',
                headline: 'blocked per month per merchant',
                desc: 'A fashion brand found 402 failed transactions, 74 were successful debits worth Rs 18.5L. Without verification, they almost cancelled legitimate orders.',
                source: 'PHI COMMERCE, 2026',
                url: 'https://ibsintelligence.com/ibsi-news/silent-payment-failures-emerge-as-hidden-drain-on-indias-d2c-profits-study-shows/'
              },
            ].map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"             /* Opens in a new tab */
                rel="noopener noreferrer"  /* Security best practice for target="_blank" */
                data-reveal-child
                className="bg-white p-6 lg:p-7 flex flex-col group hover:bg-slate-50 transition-colors duration-200 block"
              >
                <div className="text-[clamp(2rem,5vw,3rem)] font-bold tracking-tight text-[#174f43] leading-[1.1] mb-3" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {item.stat}
                </div>
                <div className="text-[13px] font-semibold text-[#0f172a] uppercase tracking-wide leading-snug mb-3">
                  {item.headline}
                </div>
                <p className="text-slate-500 text-[13px] leading-relaxed mb-5 flex-1">
                  {item.desc}
                </p>
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">
                  {item.source}
                </div>
              </a>
            ))}
          </div>

        </div>
      </section>

      {/* SECTION 3: HOW IT WORKS */}
      <section id="how-it-works" data-reveal className="bg-[#fbfaf6]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-12 py-12 lg:py-16">

          <div className="mb-8 max-w-2xl">
            <span data-reveal-child className="inline-block bg-[#174f43] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 mb-6">
              How It Works
            </span>
            <h2 data-reveal-child className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-[#0f172a] leading-[1.1] mb-4">
              From failure to recovery<br />
              <span className="text-[#174f43]">in under 30 seconds.</span>
            </h2>
            <p data-reveal-child className="text-slate-500 text-[15px] leading-relaxed">
              Every failed payment follows the same pipeline: detect, map, diagnose, decide, act, verify. No human in the loop unless the policy engine says so.
            </p>
          </div>

          <div data-reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200">
            {[
              {
                step: '01',
                title: 'Detect',
                desc: 'Failed transaction arrives via Razorpay webhook or manual ingest. Webhook event ID is deduplicated at the database level before processing.',
                tag: 'WEBHOOK / API'
              },
              {
                step: '02',
                title: 'Map',
                desc: 'Decline code is translated into one of 16 ISO-8583 banking ontology codes. Each maps to a category, base probability, and recovery path.',
                tag: 'ISO-8583 ONTOLOGY'
              },
              {
                step: '03',
                title: 'Diagnose',
                desc: 'Groq LLM analyzes the failure context, customer history, and bank behavior. Outputs root cause, recovery probability, and a Hinglish outreach message.',
                tag: 'GROQ LLM'
              },
              {
                step: '04',
                title: 'Decide',
                desc: '3-gate policy engine evaluates the diagnosis. AUTO_EXECUTE for low-risk, HUMAN_APPROVAL for medium, STOP_RULE for fraud or max retries.',
                tag: 'POLICY ENGINE'
              },
              {
                step: '05',
                title: 'Act',
                desc: 'Creates an idempotent Razorpay order with the personalized message. Customer receives a 1-click checkout link via the configured channel.',
                tag: 'RAZORPAY API'
              },
              {
                step: '06',
                title: 'Verify & Audit',
                desc: 'Webhook confirms payment status. Full provenance chain — reasoning, latency, gate decision, HMAC signature — logged immutably in Supabase.',
                tag: 'SUPABASE'
              },
            ].map((item, i) => (
              <div key={i} data-reveal-child className="bg-[#fbfaf6] p-6 lg:p-7 flex flex-col group hover:bg-white transition-colors duration-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-slate-200 leading-none select-none">
                    {item.step}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.1em]">
                    {item.tag}
                  </span>
                </div>
                <div className="text-[15px] font-semibold text-[#0f172a] mb-2">
                  {item.title}
                </div>
                <p className="text-slate-500 text-[13px] leading-relaxed flex-1">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: USE CASES */}
      <section id="scenarios" data-reveal className="bg-white border-t border-slate-200">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-12 py-12 lg:py-16">

          <div className="mb-8 max-w-2xl">
            <span data-reveal-child className="inline-block bg-[#174f43] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 mb-4">
              Use Cases
            </span>
            <h2 data-reveal-child className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-[#0f172a] leading-[1.1] mb-3">
              Built for the way payments<br />
              <span className="text-[#174f43]">actually fail.</span>
            </h2>
            <p data-reveal-child className="text-slate-500 text-[15px] leading-relaxed">
              Seven distinct failure scenarios, each with tailored retry logic, policy thresholds, and recovery messaging.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="flex overflow-x-auto scrollbar-none" role="tablist">
              {scenarios.map((sc) => {
                const isActive = activeScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveScenario(sc.id)}
                    className={`relative flex-shrink-0 px-5 py-3.5 text-[13px] font-medium whitespace-nowrap transition-all duration-150 cursor-pointer border-b-2 ${isActive
                        ? 'text-[#174f43] border-[#174f43] bg-[#f0faf5]'
                        : 'text-slate-500 border-transparent hover:text-[#0f172a] hover:bg-slate-50'
                      }`}
                  >
                    {sc.title}
                  </button>
                );
              })}
            </div>

            {/* Content Panel */}
            <div className="p-6 lg:p-10">
              {scenarios.filter(sc => sc.id === activeScenario).map(sc => (
                <div key={sc.id} className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

                  {/* Left: Description */}
                  <div className="lg:col-span-2">
                    <div className="text-[10px] text-[#174f43] font-bold uppercase tracking-widest mb-3">
                      {sc.title}
                    </div>
                    <h3 className="text-xl font-semibold text-[#0f172a] mb-3 leading-snug">
                      {scenarioDetails[sc.id]?.headline}
                    </h3>
                    <p className="text-slate-500 text-[14px] leading-relaxed mb-6">
                      {scenarioDetails[sc.id]?.desc}
                    </p>
                    <div className="flex flex-col gap-3">
                      {scenarioDetails[sc.id]?.points.map((pt, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#174f43] mt-1.5 flex-shrink-0"></div>
                          <span className="text-slate-600 text-[13px] leading-relaxed">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Dashboard Preview */}
                  <div className="lg:col-span-3">
                    <div className="bg-[#fbfaf6] rounded-lg border border-slate-200 overflow-hidden">
                      <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
                        </div>
                        <div className="flex-1 bg-slate-50 rounded border border-slate-100 px-3 py-1 text-[11px] text-slate-400">
                          retrek.in/dashboard
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="text-[9px] text-[#174f43] font-bold uppercase tracking-widest mb-1">
                          {sc.title}
                        </div>
                        <div className="text-sm font-semibold text-[#0f172a] mb-5">Recovery Overview</div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white border border-slate-100 p-3.5 rounded">
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Open</div>
                            <div className="text-2xl font-bold text-[#0f172a]">94</div>
                          </div>
                          <div className="bg-white border border-slate-100 p-3.5 rounded">
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">In Review</div>
                            <div className="text-2xl font-bold text-amber-600">12</div>
                          </div>
                          <div className="bg-white border border-slate-100 p-3.5 rounded">
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Recovered</div>
                            <div className="text-2xl font-bold text-emerald-600">₹1.4L</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0b1120] text-white border-t border-slate-800">
        <div className="max-w-[1440px] mx-auto border-x border-slate-800 relative py-10 px-6 lg:px-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-6">
                <img src="/logo.png" alt="Retrek" className="h-8 w-auto mr-2" />
                <span className="font-semibold text-lg tracking-tight">Retrek</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                AI revenue recovery engine for Razorpay. Detect, diagnose, decide, act, verify, recover.
              </p>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Product</div>
              <div className="flex flex-col gap-3 text-sm text-slate-400">
                <a href="#problem" className="hover:text-white transition-colors">Problem</a>
                <a href="#capabilities" className="hover:text-white transition-colors">How it works</a>
                <a href="#scenarios" className="hover:text-white transition-colors">Use cases</a>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Built for</div>
              <div className="text-sm text-slate-400 leading-relaxed">
                Razorpay Buildathon<br />
                Track 3: AI Revenue Recovery<br />
                2026
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Built with Node.js, React, Supabase, Groq, and Razorpay APIs
            </div>
            <div className="text-xs text-slate-500">
              All payment data is synthetic. No real transactions are processed.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
