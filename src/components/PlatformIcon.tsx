'use client';

import Image from 'next/image';

interface PlatformLogoProps {
  platform: string;
  className?: string;
  size?: number;
}

// Square logo URLs (favicons, square icons, not horizontal banners)
const squareLogos: Record<string, string> = {
  csdn: 'https://img-home.csdnimg.cn/favicon.ico',
  modb: 'https://www.modb.com.cn/favicon.ico',
  oschina: 'https://www.oschina.net/favicon.ico',
  segmentfault: 'https://static.segmentfault.com/main_site_next/prod/_next/static/media/sf-icon-small.4d244289.svg',
  sf: 'https://static.segmentfault.com/main_site_next/prod/_next/static/media/sf-icon-small.4d244289.svg',
  ctoutiao: 'https://www.51cto.com/favicon.ico',
  itpub: 'https://www.itpub.net/favicon.ico',
  toutiao: 'https://sf3-cdn-tos.douyinstatic.com/obj/eden-cn/uhbfnupkbps/toutiao_favicon.ico',
  cnblogs: 'https://www.cnblogs.com/favicon.ico',
};

// SimpleIcons SVG 
const simpleIcons: Record<string, string> = {
  juejin: 'juejin',
  zhihu: 'zhihu',
  wechat: 'wechat',
  bilibili: 'bilibili',
  youtube: 'youtube',
  twitter: 'x',
};

const fallbackColors: Record<string, string> = {
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
  twitter: '#1b8ef2',
};

export function PlatformIcon({ platform, className = '', size = 32 }: PlatformLogoProps) {
  const color = fallbackColors[platform] || '#475569';

  // Square direct logo
  const directUrl = squareLogos[platform];
  if (directUrl) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <Image
          key={`${platform}-logo`}
          src={directUrl}
          alt={platform}
          width={size}
          height={size}
          className="object-contain"
          unoptimized
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.nextElementSibling as HTMLElement;
            if (fb) fb.style.display = 'flex';
          }}
        />
        <FallbackBlock platform={platform} color={color} size={size} hidden />
      </div>
    );
  }

  // SimpleIcons SVG
  const si = simpleIcons[platform];
  if (si) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <Image
          key={`${platform}-si`}
          src={`https://cdn.simpleicons.org/${si}`}
          alt={platform}
          width={size}
          height={size}
          className="object-contain"
          unoptimized
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.nextElementSibling as HTMLElement;
            if (fb) fb.style.display = 'flex';
          }}
        />
        <FallbackBlock platform={platform} color={color} size={size} hidden />
      </div>
    );
  }

  return <FallbackBlock platform={platform} color={color} size={size} />;
}

function FallbackBlock({ platform, color, size, hidden }: { platform: string; color: string; size: number; hidden?: boolean }) {
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size <= 24 ? 9 : size * 0.32,
        display: hidden ? 'none' : 'flex',
      }}
    >
      {platform === 'toutiao' ? '头条' : platform === 'itpub' ? 'IT' : platform.slice(0, 2).toUpperCase()}
    </div>
  );
}
