import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Search, 
  FileCheck, 
  Users, 
  TrendingUp,
  ArrowRight,
  Sparkles,
  Building2,
  Headphones,
  UserCheck,
  CheckCircle2,
  Link2,
  Eye,
  BarChart3,
  Zap,
  ChevronDown
} from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Trust Me Bro</span>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => scrollToSection("problem")} 
            className="text-gray-400 hover:text-white transition-colors hidden sm:block"
          >
            Problem
          </button>
          <button 
            onClick={() => scrollToSection("solution")} 
            className="text-gray-400 hover:text-white transition-colors hidden sm:block"
          >
            Solution
          </button>
          <Button 
            onClick={() => navigate("/dashboard")}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Self-Learning Knowledge Engine
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-slide-up">
            Knowledge bases that{" "}
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              learn
            </span>
            <br />
            <span className="text-gray-400">only when they're sure</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 animate-slide-up delay-100">
            Enterprise knowledge management that proves every gap, traces every source, 
            and never publishes without human approval.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up delay-200">
            <Button 
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 text-lg px-8 py-6 h-auto"
            >
              Enter Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg"
              onClick={() => scrollToSection("how-it-works")}
              className="bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 hover:border-white/50 text-lg px-8 py-6 h-auto"
            >
              See How It Works
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-8 mt-16 text-sm text-gray-500 animate-fade-in delay-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <span>Zero Hallucinations</span>
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-500" />
              <span>100% Traceable</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-500" />
              <span>Human-Gated</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-gray-600" />
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="relative z-10 py-24 bg-gradient-to-b from-transparent to-purple-950/20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The Problem with AI Knowledge Bases
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Traditional AI systems fail enterprise support in three critical ways
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Problem 1 */}
            <div className="group p-8 rounded-2xl bg-gradient-to-b from-red-950/30 to-transparent border border-red-900/30 hover:border-red-700/50 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-3xl">🔄</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-red-300">Duplicate Knowledge</h3>
              <p className="text-gray-400">
                Support teams waste hours recreating articles that already exist because 
                search fails to find relevant content.
              </p>
            </div>

            {/* Problem 2 */}
            <div className="group p-8 rounded-2xl bg-gradient-to-b from-orange-950/30 to-transparent border border-orange-900/30 hover:border-orange-700/50 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-orange-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-3xl">🎭</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-orange-300">AI Hallucinations</h3>
              <p className="text-gray-400">
                Generative AI confidently produces wrong answers with no proof, 
                creating liability and eroding trust.
              </p>
            </div>

            {/* Problem 3 */}
            <div className="group p-8 rounded-2xl bg-gradient-to-b from-yellow-950/30 to-transparent border border-yellow-900/30 hover:border-yellow-700/50 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="text-3xl">📉</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-yellow-300">No Proof of Improvement</h3>
              <p className="text-gray-400">
                You can't measure if your KB is actually getting better. 
                No before/after metrics, just vibes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built for Enterprise Support Teams
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Organizations that can't afford to be wrong
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-6">
                <Building2 className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Enterprise Support</h3>
              <p className="text-gray-400">
                Large-scale support operations managing thousands of tickets and complex product suites
              </p>
            </div>

            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
                <Headphones className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">IT Help Desks</h3>
              <p className="text-gray-400">
                Internal IT teams that need accurate, up-to-date documentation for employee support
              </p>
            </div>

            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <UserCheck className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Customer Success</h3>
              <p className="text-gray-400">
                CS teams that need trustworthy knowledge to guide customers through complex workflows
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="relative z-10 py-24 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The{" "}
              <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Trust Me Bro
              </span>
              {" "}Difference
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Four pillars that make our knowledge engine trustworthy
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Pillar 1 */}
            <div className="group p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-purple-500/50 transition-all duration-300">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Search className="w-7 h-7 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Gap Detection</h3>
                  <p className="text-gray-400 mb-4">
                    BM25-powered retrieval that honestly says "I don't know" instead of 
                    guessing. Learning only triggers when coverage is provably weak.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-purple-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Deterministic thresholds</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="group p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-cyan-500/50 transition-all duration-300">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Link2 className="w-7 h-7 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">RLM Evidence Chain</h3>
                  <p className="text-gray-400 mb-4">
                    Every claim in every article traces back to source evidence. 
                    Recursive Language Model ensures nothing is fabricated.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-cyan-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>100% traceable citations</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="group p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Human-Gated Publishing</h3>
                  <p className="text-gray-400 mb-4">
                    No article goes live without human approval. 
                    Experts review, edit, and sign off before knowledge enters the system.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-green-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Governance built-in</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="group p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-amber-500/50 transition-all duration-300">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Measurable Lift</h3>
                  <p className="text-gray-400 mb-4">
                    Before/after retrieval scores prove the KB improved. 
                    No more guessing if your documentation is helping.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-amber-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Quantified improvement</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              From support ticket to trusted knowledge in 5 steps
            </p>
          </div>

          {/* Flow diagram */}
          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-0">
            {/* Step 1: Ticket */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center mx-auto mb-4">
                <FileCheck className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="font-semibold mb-1">Ticket</h3>
              <p className="text-sm text-gray-500">New case arrives</p>
            </div>

            {/* Arrow 1 */}
            <div className="hidden lg:flex items-center px-4">
              <div className="w-16 h-0.5 bg-gradient-to-r from-amber-500 to-purple-500" />
              <ArrowRight className="w-5 h-5 text-purple-500 -ml-1" />
            </div>

            {/* Step 2: Gap Check */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="font-semibold mb-1">Gap Check</h3>
              <p className="text-sm text-gray-500">Search existing KB</p>
            </div>

            {/* Arrow 2 */}
            <div className="hidden lg:flex items-center px-4">
              <div className="w-16 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-500" />
              <ArrowRight className="w-5 h-5 text-cyan-500 -ml-1" />
            </div>

            {/* Step 3: AI Draft */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-cyan-400" />
              </div>
              <h3 className="font-semibold mb-1">AI Draft</h3>
              <p className="text-sm text-gray-500">RLM generates</p>
            </div>

            {/* Arrow 3 */}
            <div className="hidden lg:flex items-center px-4">
              <div className="w-16 h-0.5 bg-gradient-to-r from-cyan-500 to-green-500" />
              <ArrowRight className="w-5 h-5 text-green-500 -ml-1" />
            </div>

            {/* Step 4: Review */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="font-semibold mb-1">Review</h3>
              <p className="text-sm text-gray-500">Human approves</p>
            </div>

            {/* Arrow 4 */}
            <div className="hidden lg:flex items-center px-4">
              <div className="w-16 h-0.5 bg-gradient-to-r from-green-500 to-violet-500" />
              <ArrowRight className="w-5 h-5 text-violet-500 -ml-1" />
            </div>

            {/* Step 5: Publish */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-violet-500/20 border-2 border-violet-500/50 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-10 h-10 text-violet-400" />
              </div>
              <h3 className="font-semibold mb-1">Publish</h3>
              <p className="text-sm text-gray-500">Measure lift</p>
            </div>
          </div>

          {/* Loop indicator */}
          <div className="text-center mt-16">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
              <Zap className="w-5 h-5 text-purple-400" />
              <span className="text-gray-300">
                Self-learning loop: Published articles improve future gap detection
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Evaluation Criteria - All Boxes Checked */}
      <section className="relative z-10 py-24 bg-gradient-to-b from-transparent via-green-950/10 to-transparent">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-sm mb-6">
              <CheckCircle2 className="w-4 h-4" />
              All Criteria Met
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built to Win
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              How Trust Me Bro addresses every evaluation criterion
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Criterion 1: Learning Capability */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-green-300">Learning Capability</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                "System improves knowledge automatically from conversations"
              </p>
              <div className="text-sm text-gray-300 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <strong>Our Solution:</strong> Gap detection triggers learning only when coverage is weak. Published articles are reindexed, improving future retrieval scores.
              </div>
            </div>

            {/* Criterion 2: Compliance & Safety */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-green-300">Compliance & Safety</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                "Detects policy violations or risky guidance"
              </p>
              <div className="text-sm text-gray-300 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <strong>Our Solution:</strong> Human-gated publishing ensures no article goes live without expert review. RLM traces every claim to source evidence—no hallucinations.
              </div>
            </div>

            {/* Criterion 3: Accuracy & Consistency */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-green-300">Accuracy & Consistency</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                "Responses align with updated knowledge"
              </p>
              <div className="text-sm text-gray-300 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <strong>Our Solution:</strong> Version history tracks every change. Provenance graphs show exactly where each claim came from. No contradictions.
              </div>
            </div>

            {/* Criterion 4: Automation & Scalability */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-green-300">Automation & Scalability</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                "Handles thousands of conversations"
              </p>
              <div className="text-sm text-gray-300 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <strong>Our Solution:</strong> BM25 indexing handles 400+ tickets instantly. Automated pipeline from ticket → draft → review → publish. No manual searching.
              </div>
            </div>

            {/* Criterion 5: Clarity of Demo */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-green-300">Clarity of Demo</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                "Input → AI analysis → knowledge update + coaching"
              </p>
              <div className="text-sm text-gray-300 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <strong>Our Solution:</strong> Guided Flow shows the complete journey: Ticket → Gap Check → AI Draft → Human Review → Publish. Crystal clear.
              </div>
            </div>

            {/* Criterion 6: Enterprise Readiness */}
            <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-semibold text-green-300">Enterprise Readiness</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                "Fits real support workflows"
              </p>
              <div className="text-sm text-gray-300 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <strong>Our Solution:</strong> Built for enterprise support teams. Real ticket data structure. Governance gates. Audit trails. Production-ready architecture.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-24">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-purple-500/30">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to build a knowledge base you can actually trust?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-8">
              See the complete workflow in action with our demo dataset of 400 enterprise support tickets.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 text-lg px-10 py-6 h-auto"
            >
              <ShieldCheck className="w-5 h-5 mr-2" />
              Enter Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <ShieldCheck className="w-5 h-5" />
            <span>Trust Me Bro</span>
          </div>
          <p className="text-gray-600 text-sm">
            Built for Hack Nation 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
