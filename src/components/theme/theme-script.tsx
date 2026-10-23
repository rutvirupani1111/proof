import { THEME_STORAGE_KEY } from "./theme-constants";

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
 * Must stay tiny and dependency-free.
 */
const script = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
