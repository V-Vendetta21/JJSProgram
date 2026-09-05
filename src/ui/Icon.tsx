import type { SVGProps } from 'react'

export type IconName = 'spark' | 'send' | 'upload' | 'folder' | 'undo' | 'redo' | 'bot' | 'warning' | 'settings' | 'branch' | 'check' | 'close' | 'chevronDown' | 'node' | 'plus' | 'up' | 'down'

const paths: Record<IconName, React.ReactNode> = {
  spark: <><path d="M12 2.75 14.05 9.95 21.25 12l-7.2 2.05L12 21.25l-2.05-7.2L2.75 12l7.2-2.05L12 2.75Z"/><path d="m18.5 3 .6 1.9L21 5.5l-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z"/></>,
  send: <><path d="m3 11.5 17-8-7.2 17-2.2-6.9L3 11.5Z"/><path d="m10.6 13.6 4.8-4.8"/></>,
  upload: <><path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 14.5V20h16v-5.5"/></>,
  folder: <path d="M3 6.5h7l2-2h9v15H3v-13Z"/>,
  undo: <><path d="M9 7H4v-5"/><path d="M4.5 7.5A8 8 0 1 1 5 17"/></>,
  redo: <><path d="M15 7h5v-5"/><path d="M19.5 7.5A8 8 0 1 0 19 17"/></>,
  bot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/></>,
  warning: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.2v.1"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-1.6-1H2.4V10h.1A1.7 1.7 0 0 0 4.1 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.56 4.2l.06.06A1.7 1.7 0 0 0 8.5 4.6a1.7 1.7 0 0 0 1-1.6v-.1h4.05V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.6 9a1.7 1.7 0 0 0 1.6 1h.1v4h-.1a1.7 1.7 0 0 0-1.8 1Z"/></>,
  branch: <><circle cx="7" cy="5" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M7 7v5a5 5 0 0 0 5 5h3M9 6h3a5 5 0 0 1 5 5v4"/></>,
  check: <path d="m4 12.5 5 5L20 6.5"/>,
  close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  chevronDown: <path d="m7 9.5 5 5 5-5"/>,
  node: <path d="M12 3 21 12 12 21 3 12 12 3Z"/>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  up: <><path d="M12 19V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/></>,
  down: <><path d="M12 5v14"/><path d="m6.5 13.5 5.5 5.5 5.5-5.5"/></>,
}

export function Icon({ name, className, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg className={className ? `ui-icon ${className}` : 'ui-icon'} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>
}
