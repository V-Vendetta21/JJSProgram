import { useEffect, useRef, useState } from 'react'
import './IntroSequence.css'

export function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const finishing = useRef(false)
  const skipTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const siblings = Array.from(root.current?.parentElement?.children ?? []).filter((element) => element !== root.current)
    const previous = siblings.map((element) => ({ element, inert: element.getAttribute('inert'), hidden: element.getAttribute('aria-hidden') }))
    siblings.forEach((element) => { element.setAttribute('inert', ''); element.setAttribute('aria-hidden', 'true') })
    const restore = () => previous.forEach(({ element, inert, hidden }) => {
      if (inert === null) element.removeAttribute('inert'); else element.setAttribute('inert', inert)
      if (hidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', hidden)
    })
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onComplete(); return restore }
    const leave = window.setTimeout(() => setLeaving(true), 3000)
    const done = window.setTimeout(onComplete, 3720)
    return () => {
      window.clearTimeout(leave); window.clearTimeout(done)
      window.clearTimeout(skipTimer.current)
      restore()
    }
  }, [onComplete])
  return <div ref={root} className={`intro-sequence ${leaving ? 'intro-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="JJS Moveset Studio intro">
    <div className="intro-grid" />
    <div className="intro-beam intro-beam-a" /><div className="intro-beam intro-beam-b" />
    <div className="intro-core">
      <div className="intro-mark-frame"><img src="/jjs-mark.svg" alt="" /></div>
      <div className="intro-wordmark"><span>JJS</span><strong>MOVESET STUDIO</strong></div>
      <div className="intro-rule"><i /></div>
      <p>IMAGINE. GENERATE. CONTROL.</p>
    </div>
    <div className="intro-counter"><span>01</span><i /><span>04</span></div>
    <div className="intro-credit">created by vVen</div>
    <button autoFocus className="intro-skip" onClick={() => { if (finishing.current) return; finishing.current = true; setLeaving(true); skipTimer.current = window.setTimeout(onComplete, 450) }}>SKIP INTRO</button>
  </div>
}
