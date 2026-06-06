import { IconType } from 'react-icons';
import {
  FaMicrosoft,
  FaUbuntu,
  FaFedora,
  FaRedhat,
  FaCentos,
  FaLinux,
  FaServer,
  FaFreebsd,
} from 'react-icons/fa';

export interface OSIconInfo {
  icon: IconType;
  color: string;
  bg: string;
  label: string;
}

/**
 * Map a template/VM name to a Font Awesome OS icon, colour and background classes.
 *
 * Usage:
 * ```tsx
 * const { icon: Icon, color, bg, label } = getOSInfo(template.name);
 * return <Icon className={color} />;
 * ```
 */
export function getOSInfo(templateName: string): OSIconInfo {
  const name = (templateName || '').toLowerCase();

  // ── Windows (Microsoft logo) ───────────────────────────────────────
  if (name.includes('windows') || name.includes('win')) {
    return {
      icon: FaMicrosoft,
      color: 'text-[#0078D6] dark:text-[#4CC2FF]',
      bg: 'bg-[#0078D6]/10 dark:bg-[#4CC2FF]/20',
      label: 'Windows',
    };
  }

  // ── Ubuntu ─────────────────────────────────────────────────────────
  if (name.includes('ubuntu')) {
    return {
      icon: FaUbuntu,
      color: 'text-[#E95420] dark:text-[#FF7A4D]',
      bg: 'bg-[#E95420]/10 dark:bg-[#FF7A4D]/20',
      label: 'Ubuntu',
    };
  }

  // ── Fedora ─────────────────────────────────────────────────────────
  if (name.includes('fedora')) {
    return {
      icon: FaFedora,
      color: 'text-[#51A2DA] dark:text-[#73B7E8]',
      bg: 'bg-[#51A2DA]/10 dark:bg-[#73B7E8]/20',
      label: 'Fedora',
    };
  }

  // ── Red Hat / RHEL ─────────────────────────────────────────────────
  if (name.includes('red hat') || name.includes('rhel')) {
    return {
      icon: FaRedhat,
      color: 'text-[#EE0000] dark:text-[#FF4D4D]',
      bg: 'bg-[#EE0000]/10 dark:bg-[#FF4D4D]/20',
      label: 'RHEL',
    };
  }

  // ── CentOS ─────────────────────────────────────────────────────────
  if (name.includes('centos')) {
    return {
      icon: FaCentos,
      color: 'text-[#932279] dark:text-[#D44B8C]',
      bg: 'bg-[#932279]/10 dark:bg-[#D44B8C]/20',
      label: 'CentOS',
    };
  }

  // ── Debian ─────────────────────────────────────────────────────────
  if (name.includes('debian')) {
    return {
      icon: FaLinux,             // No specific Fa brand icon; use generic Linux
      color: 'text-[#A81D33] dark:text-[#D7263D]',
      bg: 'bg-[#A81D33]/10 dark:bg-[#D7263D]/20',
      label: 'Debian',
    };
  }

  // ── Kali Linux ─────────────────────────────────────────────────────
  if (name.includes('kali')) {
    return {
      icon: FaLinux,
      color: 'text-[#557C94] dark:text-[#7A9EB5]',
      bg: 'bg-[#557C94]/10 dark:bg-[#7A9EB5]/20',
      label: 'Kali Linux',
    };
  }

  // ── Alpine Linux ───────────────────────────────────────────────────
  if (name.includes('alpine')) {
    return {
      icon: FaLinux,
      color: 'text-[#0D597F] dark:text-[#1A8CBE]',
      bg: 'bg-[#0D597F]/10 dark:bg-[#1A8CBE]/20',
      label: 'Alpine Linux',
    };
  }

  // ── Arch Linux ─────────────────────────────────────────────────────
  if (name.includes('arch')) {
    return {
      icon: FaLinux,
      color: 'text-[#1793D1] dark:text-[#4CB0E5]',
      bg: 'bg-[#1793D1]/10 dark:bg-[#4CB0E5]/20',
      label: 'Arch Linux',
    };
  }

  // ── Linux Mint ─────────────────────────────────────────────────────
  if (name.includes('mint')) {
    return {
      icon: FaLinux,
      color: 'text-[#87CF3E] dark:text-[#A5E066]',
      bg: 'bg-[#87CF3E]/10 dark:bg-[#A5E066]/20',
      label: 'Linux Mint',
    };
  }

  // ── openSUSE ───────────────────────────────────────────────────────
  if (name.includes('suse') || name.includes('opensuse')) {
    return {
      icon: FaLinux,
      color: 'text-[#73BA25] dark:text-[#95D846]',
      bg: 'bg-[#73BA25]/10 dark:bg-[#95D846]/20',
      label: 'openSUSE',
    };
  }

  // ── Rocky Linux ────────────────────────────────────────────────────
  if (name.includes('rocky')) {
    return {
      icon: FaLinux,
      color: 'text-[#10B981] dark:text-[#34D399]',  // Rocky's greenish brand
      bg: 'bg-[#10B981]/10 dark:bg-[#34D399]/20',
      label: 'Rocky Linux',
    };
  }

  // ── AlmaLinux ──────────────────────────────────────────────────────
  if (name.includes('almalinux') || name.includes('alma')) {
    return {
      icon: FaLinux,
      color: 'text-[#2A3F54] dark:text-[#4B6B8C]',   // Alma's dark blue
      bg: 'bg-[#2A3F54]/10 dark:bg-[#4B6B8C]/20',
      label: 'AlmaLinux',
    };
  }

  // ── FreeBSD ────────────────────────────────────────────────────────
  if (name.includes('freebsd')) {
    return {
      icon: FaFreebsd,
      color: 'text-[#AB2B28] dark:text-[#D44B3C]',
      bg: 'bg-[#AB2B28]/10 dark:bg-[#D44B3C]/20',
      label: 'FreeBSD',
    };
  }

  // ── Generic Linux (any remaining distro) ───────────────────────────
  if (name.includes('linux')) {
    return {
      icon: FaLinux,
      color: 'text-[#FCC624] dark:text-[#FFD866]',  // Tux yellow
      bg: 'bg-[#FCC624]/10 dark:bg-[#FFD866]/20',
      label: 'Linux',
    };
  }

  // ── Fallback (unknown / generic VM) ────────────────────────────────
  return {
    icon: FaServer,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    label: 'VM',
  };
}