/** Styles for the Proof Pass (hoisted once by React via <style href precedence>). */
export const PASS_CSS = `
.pp-scene{perspective:1100px}
.pp-card{--rx:0deg;--ry:0deg;--mx:.5;--my:.5;transform:rotateX(var(--rx)) rotateY(var(--ry));transform-style:preserve-3d;transition:transform .6s cubic-bezier(.2,.8,.2,1);will-change:transform}
.pp-card[data-live]{transition:transform .12s linear}
.pp-lift{transform:translateZ(18px)}
.pp-mesh{background:
 radial-gradient(120% 70% at 0% 0%,rgb(124 92 255/.38),transparent 55%),
 radial-gradient(90% 60% at 100% 100%,rgb(198 244 50/.16),transparent 60%),
 radial-gradient(rgb(243 240 232/.07) 1px,transparent 1px) 0 0/14px 14px}
.pp-foil{opacity:.5;mix-blend-mode:color-dodge;background:linear-gradient(115deg,transparent 18%,rgb(124 92 255/.65) 32%,rgb(64 214 255/.5) 40%,rgb(198 244 50/.55) 48%,rgb(255 122 196/.45) 56%,rgb(124 92 255/.5) 64%,transparent 80%);background-size:260% 260%;background-position:calc(var(--mx)*100%) calc(var(--my)*100%);transition:background-position .12s linear}
.pp-glare{mix-blend-mode:soft-light;background:radial-gradient(circle at calc(var(--mx)*100%) calc(var(--my)*100%),rgb(255 255 255/.38),transparent 46%)}
.pp-laser{top:8px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#7c5cff 18%,#c6f432 50%,#7c5cff 82%,transparent);box-shadow:0 0 10px 1px rgb(124 92 255/.55),0 -14px 18px -6px rgb(198 244 50/.25);opacity:.85;animation:pp-scan 3.2s cubic-bezier(.45,0,.55,1) infinite}
@keyframes pp-scan{0%{top:8px;opacity:0}8%{opacity:.85}50%{top:calc(100% - 10px);opacity:.85}58%{opacity:0}100%{top:8px;opacity:0}}
.pp-qr .pq-dot{transform-box:fill-box;transform-origin:center;transition:transform 1s cubic-bezier(.16,1,.3,1) var(--d,0ms),opacity .6s ease var(--d,0ms)}
.pp-qr .pq-finder,.pp-qr .pq-logo{transition:opacity .5s ease .45s,transform .8s cubic-bezier(.16,1,.3,1) .45s;transform-box:fill-box;transform-origin:center}
.pp-qr[data-assemble=off] .pq-dot{transform:translate(var(--dx),var(--dy)) scale(.35);opacity:0;transition:none}
.pp-qr[data-assemble=off] .pq-finder,.pp-qr[data-assemble=off] .pq-logo{opacity:0;transform:scale(.6) rotate(-40deg);transition:none}
@media (prefers-reduced-motion:reduce){
 .pp-card{transform:none!important;transition:none}
 .pp-foil{transition:none}
 .pp-laser{display:none}
 .pp-qr .pq-dot,.pp-qr .pq-finder,.pp-qr .pq-logo{transform:none!important;opacity:1!important;transition:none!important}
}
`;
