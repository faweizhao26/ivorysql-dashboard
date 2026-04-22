'use client';

import Image from 'next/image';

interface PlatformLogoProps {
  platform: string;
  className?: string;
  size?: number;
}

const platformLogos: Record<string, { url: string; width: number; height: number }> = {
  csdn: { url: 'https://mdn.alipayonline.com/csdndocs/images/logo.png', width: 32, height: 32 },
  juejin: { url: 'https://bce.bdstatic.com/cdn/bucket-editor/juejin-icon/juejin.png', width: 32, height: 32 },
  modb: { url: 'https://www.modb.com.cn/static/media/logo.9d946a5d.svg', width: 32, height: 32 },
  oschina: { url: 'https://www.oschina.cn/img/oschina-logo.svg', width: 32, height: 32 },
  sf: { url: 'https://cdn.segmentfault.com/www/2024/assets/svg/logo.svg', width: 32, height: 32 },
  ctoutiao: { url: 'https://w.www.51cto.com/favicon.ico', width: 32, height: 32 },
  itpub: { url: 'https://www.itpub.net/favicon.ico', width: 32, height: 32 },
  toutiao: { url: 'https://lf-cdn-tos.bytescm.com/obj/static/xitu_extension/static/favicon.ico', width: 32, height: 32 },
  zhihu: { url: 'https://static.zhihu.com/heifetz/favicon.ico', width: 32, height: 32 },
  cnblogs: { url: 'https://www.cnblogs.com/images/logo.svg', width: 32, height: 32 },
  wechat: { url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico', width: 32, height: 32 },
  twitter: { url: 'https://abs.twimg.com/favicons/twitter.ico', width: 32, height: 32 },
  bilibili: { url: 'https://www.bilibili.com/favicon.ico', width: 32, height: 32 },
  youtube: { url: 'https://www.youtube.com/s/desktop/favicon.ico', width: 32, height: 32 },
};

const platformColors: Record<string, string> = {
  csdn: '#fc0a1a',
  juejin: '#1e80ff',
  modb: '#ff6b00',
  oschina: '#00a651',
  sf: '#ff6a00',
  ctoutiao: '#0066cc',
  itpub: '#0094d3',
  toutiao: '#ee5242',
  zhihu: '#0066ff',
  cnblogs: '#2177ca',
  wechat: '#07c160',
  twitter: '#1da1f2',
  bilibili: '#00a1d6',
  youtube: '#ff0000',
};

export function PlatformIcon({ platform, className = '', size = 32 }: PlatformLogoProps) {
  const logo = platformLogos[platform];
  const bgColor = platformColors[platform] || '#475569';

  if (logo) {
    return (
      <div className={`relative ${className}`} style={{ width: size, height: size }}>
        <Image
          key={`${platform}-${logo.url}`}
          src={logo.url}
          alt={platform}
          width={size}
          height={size}
          className="object-contain"
          unoptimized
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded flex items-center justify-center text-white font-bold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4
      }}
    >
      {platform.slice(0, 2).toUpperCase()}
    </div>
  );
}
