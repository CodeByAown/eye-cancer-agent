import {
  FileText,
  LayoutDashboard,
  ScanEye,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
  Upload,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Present but not yet implemented — rendered with a "soon" affordance. */
  soon?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Eye",
    items: [
      { label: "Eye Scanner", href: "/dashboard/eye/scan", icon: ScanEye, badge: "Live" },
      { label: "Fundus Upload", href: "/dashboard/eye/upload", icon: Upload },
    ],
  },
  {
    title: "Oncology",
    items: [{ label: "Skin Cancer", href: "/dashboard/cancer/skin", icon: Sparkles }],
  },
  {
    title: "Workspace",
    items: [{ label: "Reports", href: "/dashboard/reports", icon: FileText }],
  },
];

export const disclaimer =
  "Educational decision-support only. Not a medical device or a substitute for a licensed clinician.";

export const complianceBadge = { icon: ShieldCheck, label: "Responsible AI" };
