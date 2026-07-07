"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Eye,
  FileText,
  MessageSquareText,
  ScanEye,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

const modules = [
  {
    icon: ScanEye,
    title: "AI Eye Scanner",
    desc: "Realtime camera scanning with face, eye & iris tracking and a futuristic medical HUD.",
    tag: "Flagship",
  },
  {
    icon: Eye,
    title: "Fundus Analysis",
    desc: "Upload retinal images for multi-disease screening with explainability heatmaps.",
  },
  {
    icon: Brain,
    title: "Cancer Detection",
    desc: "Skin and brain-MRI analysis powered by proven open-source medical models.",
  },
  {
    icon: MessageSquareText,
    title: "Medical Chat",
    desc: "A context-aware assistant grounded in your specific analysis — not a generic chatbot.",
  },
  {
    icon: FileText,
    title: "Clinical Reports",
    desc: "Hospital-grade PDF reports with findings, severity, education and QR verification.",
  },
  {
    icon: ShieldCheck,
    title: "Responsible AI",
    desc: "Educational decision-support with structural disclaimers and full audit trails.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-bg pointer-events-none absolute inset-0 -z-10" />

      {/* Nav */}
      <header className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button asChild variant="gradient" size="sm">
            <Link href="/dashboard">
              Launch app <ArrowRight />
            </Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="container flex flex-col items-center py-20 text-center md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass text-muted-foreground mb-6 rounded-full px-4 py-1.5 text-xs"
        >
          Multi-agent medical AI · Eye + Cancer · Explainable
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="max-w-4xl text-balance text-4xl font-semibold tracking-tight md:text-6xl"
        >
          The <span className="text-gradient">AI medical vision</span> platform for modern clinics
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="text-muted-foreground mt-6 max-w-2xl text-pretty text-lg"
        >
          Scan, analyze, explain and report — a premium healthcare experience built on proven
          open-source medical models and a scalable multi-agent architecture.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild variant="gradient" size="lg">
            <Link href="/dashboard/eye/scan">
              Try the Eye Scanner <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </motion.div>
      </section>

      {/* Module grid */}
      <section className="container grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m, i) => (
          <motion.div
            key={m.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
          >
            <GlassCard strong className="h-full">
              <div className="mb-4 flex items-center justify-between">
                <span className="bg-primary/12 text-primary inline-flex size-11 items-center justify-center rounded-md">
                  <m.icon className="size-5" />
                </span>
                {m.tag && (
                  <span className="bg-accent/15 text-accent rounded-full px-2.5 py-1 text-xs font-medium">
                    {m.tag}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold">{m.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm">{m.desc}</p>
            </GlassCard>
          </motion.div>
        ))}
      </section>

      {/* Disclaimer band */}
      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground container flex flex-col items-center gap-2 py-8 text-center text-xs">
          <p className="max-w-2xl">
            ⚕️ This platform provides educational, decision-support information only. It is not a
            medical device and is not a substitute for a licensed healthcare professional.
          </p>
          <Logo className="opacity-60" />
        </div>
      </footer>
    </div>
  );
}
