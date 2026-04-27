'use client';

import Image from 'next/image';

interface PlatformLogoProps {
  platform: string;
  className?: string;
  size?: number;
}

// Platforms that have official logos on SimpleIcons CDN
const simpleIcons: Record<string, { name: string; color: string }> = {
  juejin: { name: 'juejin', color: '#007FFF' },
  zhihu: { name: 'zhihu', color: '#0084FF' },
  wechat: { name: 'wechat', color: '#07C160' },
  bilibili: { name: 'bilibili', color: '#00A1D6' },
  youtube: { name: 'youtube', color: '#FF0000' },
  twitter: { name: 'x', color: '#FFFFFF' },
};

// Fallback favicon domains (for platforms not in SimpleIcons)
const faviconDomains: Record<string, string> = {
  csdn: 'csdn.net',
  oschina: 'oschina.net',
  segmentfault: 'segmentfault.com',
  ctoutiao: '51cto.com',
  itpub: 'itpub.net',
  toutiao: 'toutiao.com',
  cnblogs: 'cnblogs.com',
  modb: 'modb.com.cn',
  sf: 'segmentfault.com',
};

const fallbackColors: Record<string, string> = {
  csdn: '#fc0a1a',
  oschina: '#15b741',
  segmentfault: '#009a61',
  ctoutiao: '#0066cc',
  itpub: '#0094d3',
  toutiao: '#ee5242',
  cnblogs: '#2177ca',
  modb: '#ff6b00',
  sf: '#009a61',
  juejin: '#007FFF',
  zhihu: '#0084FF',
  wechat: '#07C160',
  bilibili: '#00A1D6',
  youtube: '#FF0000',
  twitter: '#1da1f2',
};

export function PlatformIcon({ platform, className = '', size = 32 }: PlatformLogoProps) {
  // SimpleIcons SVG logos
  const si = simpleIcons[platform];
  if (si) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <Image
          src={`https://cdn.simpleicons.org/${si.name}`}
          alt={platform}
          width={size}
          height={size}
          className="object-contain"
          unoptimized
        />
      </div>
    );
  }

  // Favicon fallback
  const domain = faviconDomains[platform];
  if (domain) {
    const color = fallbackColors[platform] || '#475569';
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <Image
          src={`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=${size * 2}`}
          alt={platform}
          width={size}
          height={size}
          className="object-contain rounded"
          unoptimized
        />
        {/* fallback block */}
        <div
          className="absolute inset-0 rounded flex items-center justify-center text-white font-bold"
          style={{
            backgroundColor: color,
            fontSize: size * 0.35,
            zIndex: -1,
          }}
        >
          {platform.length <= 4 ? platform.toUpperCase() : platform.slice(0, 2).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded flex items-center justify-center text-white font-bold ${className}`}
      style={{ width: size, height: size, backgroundColor: '#475569', fontSize: size * 0.35 }}
    >
      {platform.slice(0, 2).toUpperCase()}
    </div>
  );
}
