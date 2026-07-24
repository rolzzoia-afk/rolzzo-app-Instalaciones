import { sb } from './bootstrap.js';
import { logout } from './login.js';
import { convertirInputFileConSelector } from './selector-foto-galeria.js';

/* ===== __PRELUDE__ ===== */
export const ICON_PATHS={"phone":`<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" />`,"map-pin":`<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /> <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" />`,"headphones":`<path d="M4 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3" /> <path d="M15 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3" /> <path d="M4 15v-3a8 8 0 0 1 16 0v3" />`,"adjustments":`<path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /> <path d="M6 4v4" /> <path d="M6 12v8" /> <path d="M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /> <path d="M12 4v10" /> <path d="M12 18v2" /> <path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /> <path d="M18 4v1" /> <path d="M18 9v11" />`,"alert-triangle":`<path d="M12 9v4" /> <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /> <path d="M12 16h.01" />`,"align-box-left-top":`<path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /> <path d="M9 13h-2" /> <path d="M13 10h-6" /> <path d="M11 7h-4" />`,"brand-whatsapp":`<path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" /> <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />`,"building":`<path d="M3 21l18 0" /> <path d="M9 8l1 0" /> <path d="M9 12l1 0" /> <path d="M9 16l1 0" /> <path d="M14 8l1 0" /> <path d="M14 12l1 0" /> <path d="M14 16l1 0" /> <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" />`,"calendar-plus":`<path d="M12.5 21h-6.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5" /> <path d="M16 3v4" /> <path d="M8 3v4" /> <path d="M4 11h16" /> <path d="M16 19h6" /> <path d="M19 16v6" />`,"calendar-week":`<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /> <path d="M16 3v4" /> <path d="M8 3v4" /> <path d="M4 11h16" /> <path d="M7 14h.013" /> <path d="M10.01 14h.005" /> <path d="M13.01 14h.005" /> <path d="M16.015 14h.005" /> <path d="M13.015 17h.005" /> <path d="M7.01 17h.005" /> <path d="M10.01 17h.005" />`,"camera":`<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /> <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />`,"car":`<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5" />`,"chart-bar":`<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" /> <path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" /> <path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" /> <path d="M4 20h14" />`,"check":`<path d="M5 12l5 5l10 -10" />`,"checklist":`<path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /> <path d="M14 19l2 2l4 -4" /> <path d="M9 8h4" /> <path d="M9 12h2" />`,"chevron-down":`<path d="M6 9l6 6l6 -6" />`,"chevron-right":`<path d="M9 6l6 6l-6 6" />`,"chevrons-down":`<path d="M7 7l5 5l5 -5" /> <path d="M7 13l5 5l5 -5" />`,"chevrons-up":`<path d="M7 11l5 -5l5 5" /> <path d="M7 17l5 -5l5 5" />`,"circle-check":`<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M9 12l2 2l4 -4" />`,"clipboard-check":`<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /> <path d="M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2" /> <path d="M9 14l2 2l4 -4" />`,"clipboard-list":`<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /> <path d="M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2" /> <path d="M9 12l.01 0" /> <path d="M13 12l2 0" /> <path d="M9 16l.01 0" /> <path d="M13 16l2 0" />`,"clock-hour-4":`<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M12 12l3 2" /> <path d="M12 7v5" />`,"clock":`<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /> <path d="M12 7v5l3 3" />`,"cloud-upload":`<path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /> <path d="M9 15l3 -3l3 3" /> <path d="M12 12l0 9" />`,"device-floppy":`<path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /> <path d="M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M14 4l0 4l-6 0l0 -4" />`,"download":`<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /> <path d="M7 11l5 5l5 -5" /> <path d="M12 4l0 12" />`,"edit":`<path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /> <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415" /> <path d="M16 5l3 3" />`,"eye":`<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /> <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />`,"file-spreadsheet":`<path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /> <path d="M8 11h8v7h-8l0 -7" /> <path d="M8 15h8" /> <path d="M11 11v7" />`,"file-text":`<path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /> <path d="M9 9l1 0" /> <path d="M9 13l6 0" /> <path d="M9 17l6 0" />`,"file-type-pdf":`<path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /> <path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /> <path d="M17 18h2" /> <path d="M20 15h-3v6" /> <path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1" />`,"file":`<path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />`,"gift":`<path d="M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" /> <path d="M12 8l0 13" /> <path d="M19 12l0 7a2 2 0 0 1 -2 2l-10 0a2 2 0 0 1 -2 -2l0 -7" /> <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />`,"gauge":`<path d="M12 15m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M12 6l0 3" /> <path d="M16.6 16.6a5.5 6 0 1 0 -9.2 0" /> <path d="M13.41 10.59l2.59 -2.59" /> <path d="M3 21h18" />`,"calendar-event":`<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /> <path d="M16 3v4" /> <path d="M8 3v4" /> <path d="M4 11h16" /> <path d="M11 15h1" /> <path d="M12 15v3" />`,"camera-off":`<path d="M3 3l18 18" /> <path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h2m4 0h2a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9c0 .27 -.055 .527 -.155 .762m-2.845 1.238h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /> <path d="M9.174 9.176a3 3 0 1 0 4.248 4.24" />`,"clock-exclamation":`<path d="M20.984 12.53a9 9 0 1 0 -8.451 8.465" /> <path d="M12 7v5l2 2" /> <path d="M21 15v3" /> <path d="M21 21v.01" />`,"clock-pause":`<path d="M20.968 12.554a9 9 0 1 0 -8.414 8.44" /> <path d="M12 7v5l3 3" /> <path d="M17 17v5" /> <path d="M21 17v5" />`,"droplet":`<path d="M6.8 11a6 6 0 1 0 10.396 0l-4.396 -6.9l-1.55 2.05" />`,"eraser":`<path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9 9" /> <path d="M18 13.3l-6.3 -6.3" />`,"folder":`<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" />`,"settings":`<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /> <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />`,"id":`<path d="M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -10" /> <path d="M7 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M15 8l2 0" /> <path d="M15 12l2 0" /> <path d="M7 16l10 0" />`,"inbox":`<path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /> <path d="M4 13h3l3 3h4l3 -3h3" />`,"list-details":`<path d="M13 5h8" /> <path d="M13 9h5" /> <path d="M13 15h8" /> <path d="M13 19h5" /> <path d="M3 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /> <path d="M3 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />`,"list":`<path d="M9 6l11 0" /> <path d="M9 12l11 0" /> <path d="M9 18l11 0" /> <path d="M5 6l0 .01" /> <path d="M5 12l0 .01" /> <path d="M5 18l0 .01" />`,"logout":`<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /> <path d="M9 12h12l-3 -3" /> <path d="M18 15l3 -3" />`,"message-2":`<path d="M8 9h8" /> <path d="M8 13h6" /> <path d="M9 18h-3a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-3l-3 3l-3 -3" />`,"message-plus":`<path d="M8 9h8" /> <path d="M8 13h6" /> <path d="M12.01 18.594l-4.01 2.406v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5.5" /> <path d="M16 19h6" /> <path d="M19 16v6" />`,"message-star":`<path d="M8 9h8" /> <path d="M8 13h4.5" /> <path d="M10.325 19.605l-2.325 1.395v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v4.5" /> <path d="M17.8 20.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138" />`,"palette":`<path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /> <path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />`,"pencil":`<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /> <path d="M13.5 6.5l4 4" />`,"photo":`<path d="M15 8h.01" /> <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /> <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /> <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />`,"player-play":`<path d="M7 4v16l13 -8l-13 -8" />`,"plus":`<path d="M12 5l0 14" /> <path d="M5 12l14 0" />`,"report":`<path d="M8 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h5.697" /> <path d="M18 14v4h4" /> <path d="M18 11v-4a2 2 0 0 0 -2 -2h-2" /> <path d="M8 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2" /> <path d="M14 18a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /> <path d="M8 11h4" /> <path d="M8 15h3" />`,"route":`<path d="M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /> <path d="M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4" /> <path d="M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5" />`,"search":`<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /> <path d="M21 21l-6 -6" />`,"shield-check":`<path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" /> <path d="M15 19l2 2l4 -4" />`,"shield-lock":`<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /> <path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M12 12l0 2.5" />`,"shield-star":`<path d="M11.143 20.743a12 12 0 0 1 -7.643 -14.743a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3c.504 1.716 .614 3.505 .343 5.237" /> <path d="M17.8 20.817l-2.172 1.138a.392 .392 0 0 1 -.568 -.41l.415 -2.411l-1.757 -1.707a.389 .389 0 0 1 .217 -.665l2.428 -.352l1.086 -2.193a.392 .392 0 0 1 .702 0l1.086 2.193l2.428 .352a.39 .39 0 0 1 .217 .665l-1.757 1.707l.414 2.41a.39 .39 0 0 1 -.567 .411l-2.172 -1.138" />`,"star":`<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" />`,"steering-wheel":`<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M12 14l0 7" /> <path d="M10 12l-6.75 -2" /> <path d="M14 12l6.75 -2" />`,"tag":`<path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3" />`,"tool":`<path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" />`,"tools":`<path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" /> <path d="M14.5 5.5l4 4" /> <path d="M12 8l-5 -5l-4 4l5 5" /> <path d="M7 8l-1.5 1.5" /> <path d="M16 12l5 5l-4 4l-5 -5" /> <path d="M16 17l-1.5 1.5" />`,"trash":`<path d="M4 7l16 0" /> <path d="M10 11l0 6" /> <path d="M14 11l0 6" /> <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /> <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />`,"trophy":`<path d="M8 21l8 0" /> <path d="M12 17l0 4" /> <path d="M7 4l10 0" /> <path d="M17 4v8a5 5 0 0 1 -10 0v-8" /> <path d="M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /> <path d="M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />`,"upload":`<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /> <path d="M7 9l5 -5l5 5" /> <path d="M12 4l0 12" />`,"user-circle":`<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /> <path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />`,"user-plus":`<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /> <path d="M16 19h6" /> <path d="M19 16v6" /> <path d="M6 21v-2a4 4 0 0 1 4 -4h4" />`,"user":`<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /> <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />`,"users":`<path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /> <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /> <path d="M16 3.13a4 4 0 0 1 0 7.75" /> <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />`,"video":`<path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4" /> <path d="M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8" />`,"x":`<path d="M18 6l-12 12" /> <path d="M6 6l12 12" />`};
export function renderIcons(root){
  const scope=root||document;
  const nodes=scope.querySelectorAll('i.ti');
  nodes.forEach(el=>{
    if(el.dataset.iconRendered)return;
    const cls=[...el.classList].find(c=>c!=='ti'&&c.startsWith('ti-'));
    if(!cls)return;
    const name=cls.slice(3);
    const svgInner=ICON_PATHS[name];
    if(!svgInner)return;
    const isChevron=el.classList.contains('sb-chevron');
    const extraClass=el.className.split(' ').filter(c=>c!=='ti'&&c!==cls).join(' ');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('width','1em');
    svg.setAttribute('height','1em');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('aria-hidden','true');
    svg.innerHTML=svgInner;
    svg.setAttribute('class','ti-svg '+cls+(extraClass?(' '+extraClass):''));
    el.replaceWith(svg);
  });
}
export const iconObserver=new MutationObserver(muts=>{
  let needsRender=false;
  for(const m of muts){
    if(m.addedNodes&&m.addedNodes.length){needsRender=true;break;}
  }
  if(needsRender){renderIcons(document);activarInputsFilesrc(document);}
});
/* Busca inputs de archivo marcados con data-filesrc (agregados dinámicamente
   en formularios de documentos/fotos) y los convierte automáticamente en
   botones con el selector Foto/Galería/Escanear, sin tener que acordarse de
   llamarlo a mano cada vez que se regenera ese HTML. */
export function activarInputsFilesrc(root){
  (root||document).querySelectorAll('input[type="file"][data-filesrc]:not([data-filesrc-ready])').forEach(input=>{
    if(!input.id)return;
    convertirInputFileConSelector(input.id,input.dataset.filesrc);
  });
}
document.addEventListener('DOMContentLoaded',()=>{
  renderIcons(document);
  activarInputsFilesrc(document);
  iconObserver.observe(document.body,{childList:true,subtree:true});
});

export const MESES=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
export const rgVals={};

export const DEFAULT_LISTS={
  tiposCortina:['ROLLER','VERTICAL','ROLLER, VERTICAL','DÚO'],
  vehiculos:['LDRJ-72','RCPC-78','RBVG-99'],
  adicionales:['NINGUNO','CENEFA CUADRADA','MOTOR','SOFT LIGHT','DARK ROLLER','HUB','CENEFA CUADRADA, MOTOR','SOFT LIGHT, MOTOR'],
  garantias:['— NO APLICA —','ANCLAJE DE CORTINA','CAMBIO DE MOTOR','CAMBIO DE TELA','CADENA','CLUTCH/MECANISMO ROLLER','ZUNCHO','DOMÓTICA-CONFIGURACIÓN','FALLA DE MOTOR','MALA TOMA DE MEDIDAS','REINSTALACIÓN','TOPE','OTRO'],
  materiales:['CONCRETO','VULCANITA','OTRO','CONCRETO, VULCANITA','PORCELANATO','MADERA'],
  problemas:['NINGUNO','MALA TOMA DE MEDIDAS','CIERRE DE MUROS','ERROR EN ARMADO','PROBLEMA CON SOFT LIGHT','PROBLEMA CON DARK ROLLER','PROBLEMA CON CENEFA CUADRADA','OTRO'],
  soluciones:['— NO APLICA —','EN TERRENO','TRASLADO A TALLER'],
  queSoluciono:['— NO APLICA —','OTRO','PERFIL BASE','CAMBIO DE LADO DE MECANISMO CENEFA OVALADA','CAMBIO DE SENTIDO-ARMADO','CUCHILLA TELA'],
  traslados:['NO APLICA','30 MIN','1 HORA','1 HORA Y MEDIA','2 HORAS','2 HORAS Y MEDIA','MÁS DE 3 HORAS'],
  docTypes:['Permiso de Circulación','Revisión Técnica (certificado)','SOAP','Seguro (póliza)','Certificado de Homologación de Gases','Padrón / Certificado de Inscripción','Factura de compra','Contrato de Leasing','Factura de mantención / repuestos','Comprobante de pago de multas','Otro'],
  mantNombres:['Cambio de Aceite','Cambio de Filtro de Aceite','Cambio de Filtro de Aire Motor','Filtro de Aire Acondicionado','Cambio de Aceite de Caja','Cambio de Bujías','Mantención de Frenos','Alineación, Balanceo y Amortiguadores','Revisión Técnica','Fluidos - Refrigerante','Fluidos - Líquido de Freno','Fluidos - Agua Parabrisas'],
  formasPago:['COPEC','TRANSFERENCIA','EFECTIVO'],
  combustibles:['FULL','MEDIO','BAJO']
};
export const CORE_KEYS=Object.keys(DEFAULT_LISTS);
export const CAT_META={
  tiposCortina:{label:'Tipos de cortina (Registro)',icon:'ti-align-box-left-top'},
  vehiculos:{label:'Vehículos - patentes (Unidad)',icon:'ti-car'},
  adicionales:{label:'Adicionales (Registro)',icon:'ti-plus'},
  garantias:{label:'Tipos de garantía (Registro)',icon:'ti-tools'},
  materiales:{label:'Materiales donde se instala (Registro)',icon:'ti-building'},
  problemas:{label:'Tipos de problema (Registro)',icon:'ti-alert-triangle'},
  soluciones:{label:'Soluciones (Registro)',icon:'ti-check'},
  queSoluciono:{label:'Qué se solucionó (Registro)',icon:'ti-checklist'},
  traslados:{label:'Tiempos de traslado (Registro)',icon:'ti-clock'},
  docTypes:{label:'Tipos de documento (Unidad)',icon:'ti-file-text'},
  mantNombres:{label:'Nombres de mantención (Unidad)',icon:'ti-tool'},
  formasPago:{label:'Formas de pago (Unidad)',icon:'ti-file-spreadsheet'},
  combustibles:{label:'Niveles de combustible (Unidad)',icon:'ti-route'}
};

/* Parámetros OFICIALES de cada mantención: cada cuántos km o meses
   corresponde, según la tabla entregada por el cliente. Estos valores NO
   los define el operario en el formulario — son fijos y vienen del
   fabricante/política de la empresa, para que nadie los cambie por error.
   modo:'km' usa intervaloKm; modo:'tiempo' usa intervaloMeses. */
export const MANT_PARAMS={
  'Cambio de Aceite':{modo:'km',intervaloKm:9000},
  'Cambio de Filtro de Aceite':{modo:'km',intervaloKm:18000},
  'Cambio de Filtro de Aire Motor':{modo:'km',intervaloKm:15000},
  'Filtro de Aire Acondicionado':{modo:'km',intervaloKm:20000},
  'Cambio de Aceite de Caja':{modo:'km',intervaloKm:30000},
  'Cambio de Bujías':{modo:'km',intervaloKm:30000},
  'Mantención de Frenos':{modo:'km',intervaloKm:10000},
  'Alineación, Balanceo y Amortiguadores':{modo:'km',intervaloKm:40000},
  'Revisión Técnica':{modo:'tiempo',intervaloMeses:12},
  'Fluidos - Refrigerante':{modo:'km',intervaloKm:10000},
  'Fluidos - Líquido de Freno':{modo:'km',intervaloKm:40000},
  'Fluidos - Agua Parabrisas':{modo:'km',intervaloKm:10000}
};

export const DEFAULT_PERSONAS=[{nombre:'ADRIANA PASCUZZO',codigo:'0001',rol:'admin',esNuevo:false,diasPrueba:null,fechaIngreso:null}];


export const COLOR_PRESETS=[
  {name:'Negro',hex:'#0D0D0D'},
  {name:'Azul Instalación',hex:'#123A54'},
  {name:'Azul Cielo',hex:'#1D5C8A'},
  {name:'Turquesa',hex:'#0F6E64'},
  {name:'Verde Bosque',hex:'#1E6B3D'},
  {name:'Oliva',hex:'#6B6B1E'},
  {name:'Ámbar Oscuro',hex:'#8A5A0F'},
  {name:'Terracota',hex:'#8A3A1F'},
  {name:'Burdeos',hex:'#7A1F2E'},
  {name:'Morado',hex:'#4A2D7A'}
];

export const NAV_ITEMS=[
  {key:'reg',label:'Registro',icon:'ti-edit',color:'#2a78d6',adminOnly:false,children:[
    {key:'regnew',label:'Registro',icon:'ti-edit',color:'#2a78d6',sub:'Nueva visita de instalación'},
    {key:'regrep',label:'Reportes',icon:'ti-report',color:'#2a78d6',sub:'Historial de OTs'},
    {key:'reg_formulario',label:'Formulario',icon:'ti-clipboard-check',color:'#2a78d6',sub:'Reporte de instalación y certificado de conformidad'}
  ]},
  {key:'dash',label:'Dashboard',icon:'ti-chart-bar',color:'#0F9D8A',sub:'Indicadores generales',adminOnly:false},
  {key:'uni',label:'Unidad',icon:'ti-car',color:'#eda100',adminOnly:false,children:[
    {key:'unireg',label:'Registro',icon:'ti-edit',color:'#eda100',sub:'Registro de vehículo'},
    {key:'unimant',label:'Mantenciones',icon:'ti-tool',color:'#eda100',sub:'Aceite, revisión técnica y documentos'},
    {key:'uniflota',label:'Estado de flota',icon:'ti-gauge',color:'#eda100',sub:'Estado de mantenciones de la flota completa'},
    {key:'unirep',label:'Reportes',icon:'ti-report',color:'#eda100',sub:'Historial de uso por patente'}
  ]},
  {key:'eval',label:'Evaluaciones',icon:'ti-star',color:'#4F46E5',adminOnly:true,children:[
    {key:'evalnuevo',label:'Personal Nuevo',icon:'ti-user-plus',color:'#4F46E5',sub:'Seguimiento en período de prueba'}
  ]},
  {key:'seguimiento',label:'Seguimiento',icon:'ti-headphones',color:'#E65100',adminOnly:false,children:[
    {key:'seg_resenas',label:'Reseñas',icon:'ti-message-star',color:'#E65100',sub:'Seguimiento de reseñas pendientes'},
    {key:'seg_fotos',label:'Evaluación de Fotos',icon:'ti-camera',color:'#E65100',sub:'Control de calidad y feedback'},
    {key:'seg_reportes',label:'Reportes',icon:'ti-report',color:'#E65100',sub:'Métricas de calidad'}
  ]},
  {key:'adm',label:'Listas',icon:'ti-list-details',color:'#6B4AA7',sub:'Opciones de los formularios',adminOnly:true},
  {key:'per',label:'Personas',icon:'ti-users',color:'#C2427A',sub:'Accesos al sistema',adminOnly:true}
];

export let navGroupOpen={};
export function __set_navGroupOpen(v){ navGroupOpen = v; }
export let currentTab='regnew';
export function __set_currentTab(v){ currentTab = v; }
export let otContext=null;
export function __set_otContext(v){ otContext = v; }
export let lists={...DEFAULT_LISTS};
export function __set_lists(v){ lists = v; }
export let customLists={};
export function __set_customLists(v){ customLists = v; }
export let registros=[];
export function __set_registros(v){ registros = v; }
export let unidades=[];
export function __set_unidades(v){ unidades = v; }
export let vehiculoData={};
export function __set_vehiculoData(v){ vehiculoData = v; }
export let mantSelected=null;
export function __set_mantSelected(v){ mantSelected = v; }
export let personas=[...DEFAULT_PERSONAS];
export function __set_personas(v){ personas = v; }
export let themeColor=COLOR_PRESETS[0].hex;
export function __set_themeColor(v){ themeColor = v; }
export let charts={};
export function __set_charts(v){ charts = v; }
export let session=null;
export function __set_session(v){ session = v; }
export let editMode=false;
export function __set_editMode(v){ editMode = v; }
