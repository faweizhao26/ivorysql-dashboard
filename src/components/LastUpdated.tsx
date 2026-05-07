'use client';

import { useState, useEffect } from 'react';

export default function LastUpdated() {
  const [date, setDate] = useState('');

  useEffect(() => {
    setDate(new Date().toLocaleDateString('zh-CN'));
  }, []);

  if (!date) return null;

  return <>最后更新: {date}</>;
}
