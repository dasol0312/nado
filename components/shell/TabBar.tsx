"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeGroups, upcomingMatches } from "@/lib/plan-lists";
import { useApp } from "./AppProvider";
import { BellIcon, CalendarIcon, GroupIcon } from "./icons";

export default function TabBar() {
  const path = usePathname();
  const { plans, now } = useApp();
  const newCount = upcomingMatches(plans, now).length;
  const groupCount = activeGroups(plans, now).length;
  const tabs = [
    { href: "/profile", label: "Profile", icon: <CalendarIcon />, n: 0 },
    { href: "/matches", label: "Matches", icon: <BellIcon />, n: newCount },
    { href: "/groups", label: "Groups", icon: <GroupIcon />, n: groupCount },
  ];
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "on" : ""} aria-current={path === t.href ? "page" : undefined}>
          {t.icon}
          {t.label}
          {t.n > 0 && <span className="dot">{t.n}</span>}
        </Link>
      ))}
    </nav>
  );
}
