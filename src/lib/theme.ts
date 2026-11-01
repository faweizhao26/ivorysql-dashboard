export type Theme = 'light' | 'dark';

export const THEME_INIT_SCRIPT = `(()=>{let theme='light';try{theme=localStorage.getItem('theme')==='dark'?'dark':'light'}catch{}const element=document.documentElement;element.dataset.theme=theme;element.style.colorScheme=theme})();`;
