import { color, radius, font, motion } from "./tokens";

// ── GLOBAL DESIGN-SYSTEM STYLESHEET ─────────────────────────
// Inline styles (used everywhere in this codebase, in both React and the
// vanilla-DOM crop overlay) can't express :hover/:active/:focus-visible —
// this is the one small stylesheet that fills that gap, injected once per
// document. Popup and the content script each get their own `document`, so
// this runs once per popup open and once per page the content script loads
// into — idempotent via the id check below either way.
const STYLE_ELEMENT_ID = "beheld-design-system-styles";

const css = `
.bh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: ${font.family};
  font-weight: ${font.weight.medium};
  border-radius: ${radius.md}px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background ${motion.fast}, border-color ${motion.fast}, color ${motion.fast}, opacity ${motion.fast};
  white-space: nowrap;
}
.bh-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px ${color.focusRing};
}
.bh-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.bh-btn--md { height: 36px; padding: 0 14px; font-size: ${font.size.base}px; }
.bh-btn--sm { height: 28px; padding: 0 10px; font-size: ${font.size.sm}px; }
.bh-btn--full { width: 100%; }

.bh-btn--primary { background: ${color.brand}; color: ${color.brandTextOn}; }
.bh-btn--primary:hover:not(:disabled) { background: ${color.brandHover}; }
.bh-btn--primary:active:not(:disabled) { background: ${color.brandPressed}; }

.bh-btn--secondary { background: ${color.bgSubtle}; color: ${color.textPrimary}; border-color: ${color.border}; }
.bh-btn--secondary:hover:not(:disabled) { background: ${color.bgHover}; border-color: ${color.borderStrong}; }
.bh-btn--secondary:active:not(:disabled) { background: ${color.bgHover}; }

.bh-btn--tertiary { background: transparent; color: ${color.textSecondary}; }
.bh-btn--tertiary:hover:not(:disabled) { background: ${color.bgSubtle}; color: ${color.textPrimary}; }

.bh-btn--destructive { background: transparent; color: ${color.error}; }
.bh-btn--destructive:hover:not(:disabled) { background: rgba(226,104,95,0.12); }

.bh-btn__icon { display: inline-flex; align-items: center; }

.bh-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: ${radius.sm}px;
  padding: 8px 10px;
  font-family: ${font.family};
  font-size: ${font.size.base}px;
  color: ${color.textSecondary};
  cursor: pointer;
  transition: background ${motion.fast}, color ${motion.fast};
}
.bh-menu-item:hover:not(:disabled) { background: ${color.bgHover}; color: ${color.textPrimary}; }
.bh-menu-item:disabled { cursor: default; opacity: 0.5; }
.bh-menu-item:focus-visible { outline: none; box-shadow: 0 0 0 2px ${color.focusRing} inset; }

.bh-row {
  border-radius: ${radius.md}px;
  transition: background ${motion.fast}, border-color ${motion.fast};
}
.bh-row:hover { background: ${color.bgHover}; }

.bh-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${radius.sm}px;
  border: none;
  background: transparent;
  color: ${color.textMuted};
  cursor: pointer;
  transition: background ${motion.fast}, color ${motion.fast};
}
.bh-icon-btn:hover:not(:disabled) { background: ${color.bgHover}; color: ${color.textPrimary}; }
.bh-icon-btn--danger:hover:not(:disabled) { background: rgba(226,104,95,0.12); color: ${color.error}; }
.bh-icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px ${color.focusRing}; }

.bh-link-button {
  border: none;
  background: transparent;
  color: ${color.brand};
  padding: 0;
  font-family: ${font.family};
  font-size: ${font.size.sm}px;
  font-weight: ${font.weight.medium};
  cursor: pointer;
}
.bh-link-button:hover { color: ${color.brandHover}; text-decoration: underline; }
.bh-link-button:focus-visible { outline: none; box-shadow: 0 0 0 2px ${color.focusRing}; border-radius: ${radius.sm}px; }

.bh-thumbnail-delete { opacity: 0; transition: opacity ${motion.fast}; }
.bh-thumbnail:hover .bh-thumbnail-delete, .bh-thumbnail:focus-within .bh-thumbnail-delete { opacity: 1; }
`;

export function injectDesignSystemStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ELEMENT_ID;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

// Ensures the stylesheet exists as soon as any file imports from the design
// system, without every consumer needing to remember to call this themselves.
injectDesignSystemStyles();
