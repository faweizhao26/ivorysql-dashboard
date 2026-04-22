'use client';

interface PlatformIconProps {
  platform: string;
  className?: string;
}

export function PlatformIcon({ platform, className = '' }: PlatformIconProps) {
  const baseClass = `w-6 h-6 rounded flex items-center justify-center text-sm font-bold ${className}`;

  switch (platform) {
    case 'csdn':
      return (
        <div className={`${baseClass} bg-blue-600 text-white`}>
          C
        </div>
      );
    case 'juejin':
      return (
        <div className={`${baseClass} bg-gradient-to-br from-blue-500 to-purple-600 text-white`}>
          J
        </div>
      );
    case 'modb':
      return (
        <div className={`${baseClass} bg-gradient-to-br from-orange-500 to-red-500 text-white`}>
          M
        </div>
      );
    case 'oschina':
      return (
        <div className={`${baseClass} bg-green-500 text-white`}>
          开
        </div>
      );
    case 'sf':
      return (
        <div className={`${baseClass} bg-orange-500 text-white`}>
          <span className="text-lg">⚡</span>
        </div>
      );
    case 'ctoutiao':
      return (
        <div className={`${baseClass} bg-blue-500 text-white`}>
          51
        </div>
      );
    case 'itpub':
      return (
        <div className={`${baseClass} bg-gradient-to-br from-blue-600 to-cyan-500 text-white`}>
          IT
        </div>
      );
    case 'toutiao':
      return (
        <div className={`${baseClass} bg-orange-500 text-white`}>
          头条
        </div>
      );
    case 'ifclub':
      return (
        <div className={`${baseClass} bg-blue-600 text-white`}>
          IF
        </div>
      );
    case 'zhihu':
      return (
        <div className={`${baseClass} bg-blue-500 text-white`}>
          知
        </div>
      );
    case 'cnblogs':
      return (
        <div className={`${baseClass} bg-blue-600 text-white`}>
          博客园
        </div>
      );
    case 'wechat':
      return (
        <div className={`${baseClass} bg-green-500 text-white`}>
          微
        </div>
      );
    default:
      return (
        <div className={`${baseClass} bg-slate-600 text-white`}>
          {platform.charAt(0).toUpperCase()}
        </div>
      );
  }
}

export function getPlatformIcon(platform: string): React.ReactNode {
  return <PlatformIcon platform={platform} />;
}
