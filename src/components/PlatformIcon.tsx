'use client';

import Image from 'next/image';

interface PlatformLogoProps {
  platform: string;
  className?: string;
  size?: number;
}

const logoDomains: Record<string, string> = {
  csdn: 'csdn.net',
  juejin: 'juejin.cn',
  modb: 'modb.com.cn',
  oschina: 'oschina.net',
  sf: 'segmentfault.com',
  ctoutiao: '51cto.com',
  itpub: 'itpub.net',
  toutiao: 'toutiao.com',
  zhihu: 'zhihu.com',
  cnblogs: 'cnblogs.com',
  wechat: 'weixin.qq.com',
  twitter: 'twitter.com',
  bilibili: 'bilibili.com',
  youtube: 'youtube.com',
};

const fallbackColors: Record<string, string> = {
  csdn: '#fc0a1a',
  juejin: '#1e80ff',
  modb: '#ff6b00',
  oschina: '#15b741',
  sf: '#ff6a00',
  ctoutiao: '#0066cc',
  itpub: '#0094d3',
  toutiao: '#ee5242',
  zhihu: '#0066ff',
  cnblogs: '#2177ca',
  wechat: '#07c160',
  twitter: '#1b8ef2',
  bilibili: '#00a1d6',
  youtube: '#ff0000',
};

export function PlatformIcon({ platform, className = '', size = 32 }: PlatformLogoProps) {
  const domain = logoDomains[platform];

  if (domain) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`;
    const color = fallbackColors[platform] || '#475569';

    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <Image
          src={faviconUrl}
          alt={platform}
          width={size}
          height={size}
          className="object-contain rounded"
          unoptimized
          onError={() => {}}
        />
        {/* fallback colored dot */}
        <div
          className="absolute inset-0 rounded flex items-center justify-center text-white font-bold"
          style={{
            backgroundColor: color,
            fontSize: size * 0.35,
            zIndex: -1,
          }}
        >
          {platform === 'toutiao' ? '头条' : platform.slice(0, 2).toUpperCase()}
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
