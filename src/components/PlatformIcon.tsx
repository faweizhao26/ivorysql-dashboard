'use client';

import Image from 'next/image';

interface PlatformLogoProps {
  platform: string;
  className?: string;
  size?: number;
}

// Direct verified logo URLs
const directLogos: Record<string, string> = {
  csdn: 'https://img-home.csdnimg.cn/images/20201124032511.png',
  modb: 'https://js-cdn.modb.cc/image/indexlogo.png',
  oschina: 'https://www.oschina.net/img/logo.svg',
  segmentfault: 'https://static.segmentfault.com/main_site_next/prod/_next/static/media/logo-b.1ef53c6e.svg',
  sf: 'https://static.segmentfault.com/main_site_next/prod/_next/static/media/sf-icon-small.4d244289.svg',
  ctoutiao: 'https://bkimg.cdn.bcebos.com/pic/aa59892bb2575397e6cd409a',
  toutiao: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Toutiao_logo.svg',
  cnblogs: 'https://assets.cnblogs.com/logo_square.png',
};

// SimpleIcons SVG (for platforms with good vector icons)
const simpleIcons: Record<string, string> = {
  juejin: 'juejin',
  zhihu: 'zhihu',
  wechat: 'wechat',
  bilibili: 'bilibili',
  youtube: 'youtube',
  twitter: 'x',
};

function LogoImage({ src, alt, size }: { src: string; alt: string; size: number }) {
  return (
    <Image
      key={encodeURIComponent(src)}
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="object-contain"
      unoptimized
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const fallback = target.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = 'flex';
      }}
    />
  );
}

export function PlatformIcon({ platform, className = '', size = 32 }: PlatformLogoProps) {
  const color = platformColors[platform] || '#475569';

  // Direct logo URL
  const directUrl = directLogos[platform];
  if (directUrl) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <LogoImage src={directUrl} alt={platform} size={size} />
        <FallbackBlock platform={platform} color={color} size={size} hidden />
      </div>
    );
  }

  // SimpleIcons SVG
  const si = simpleIcons[platform];
  if (si) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <LogoImage src={`https://cdn.simpleicons.org/${si}`} alt={platform} size={size} />
        <FallbackBlock platform={platform} color={color} size={size} hidden />
      </div>
    );
  }

  // ITPUB - no logo available, use branded block
  if (platform === 'itpub') {
    return (
      <FallbackBlock platform={platform} color={color} size={size} />
    );
  }

  return <FallbackBlock platform={platform} color={color} size={size} />;
}

function FallbackBlock({ platform, color, size, hidden }: { platform: string; color: string; size: number; hidden?: boolean }) {
  return (
    <div
      className={`rounded flex items-center justify-center text-white font-bold ${hidden ? 'absolute inset-0' : ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size <= 24 ? 10 : size * 0.35,
        display: hidden ? 'none' : 'flex',
      }}
    >
      {platform === 'toutiao' ? '头条' : platform.slice(0, 2).toUpperCase()}
    </div>
  );
}

const platformColors: Record<string, string> = {
  csdn: '#fc0a1a',
  oschina: '#009966',
  segmentfault: '#009a61',
  sf: '#009a61',
  ctoutiao: '#0066cc',
  itpub: '#0094d3',
  toutiao: '#ee5242',
  cnblogs: '#2177ca',
  modb: '#ff6b00',
  juejin: '#007FFF',
  zhihu: '#0084FF',
  wechat: '#07C160',
  bilibili: '#00A1D6',
  youtube: '#FF0000',
  twitter: '#1da1f2',
};
