function lootPanelSnapshot() {
  const current=window.__CAT_DEBUG__.read().state;
  const dom=(()=>{
        // C18-B: a round with opened orbs renders orb cards (orb-loot); otherwise the plain list (loot-panel).
        const panel = document.querySelector('[data-debug="loot-panel"],[data-debug="orb-loot"],[data-debug="loot-terminal"]');
        const button = document.querySelector('[data-debug="mobile:continue"]');
        if (!panel) return { kind: null, continueDisabled: button?.disabled ?? null, continueReason: button?.dataset.blockedReason ?? null };
        return { kind: panel.dataset.debug, canContinue: panel.dataset.canContinue ?? null,
          block: panel.querySelector('.loot-blocked')?.dataset.reason ?? null,
          buttons: panel.querySelectorAll('button').length,
          pendingDrop: panel.querySelector('[data-debug="loot-pending-choice"]')?.dataset.dropId ?? null,
          dialogDrop: document.querySelector('.choice-dialog')?.dataset.dropId ?? null,
          dialogSource: document.querySelector('.choice-dialog')?.dataset.choiceSource ?? null,
          dialogText: document.querySelector('.choice-dialog')?.textContent ?? '',
          continueDisabled: document.querySelector('[data-debug="mobile:continue"]')?.disabled ?? null,
          continueReason: document.querySelector('[data-debug="mobile:continue"]')?.dataset.blockedReason ?? null,
          orbs: [...panel.querySelectorAll('[data-debug^="orb:"]')].filter(card => card.dataset.debug !== 'orb:other').map(card => ({ orbId: card.dataset.debug.slice('orb:'.length), tier: card.dataset.tier, status: card.dataset.status })),
          rows: [...panel.querySelectorAll('[data-debug^="loot-drop:"],[data-debug^="orb-entry:"]')].map(row => ({ dropId: row.dataset.debug.slice(row.dataset.debug.indexOf(':') + 1), status: row.dataset.status, receipt: row.dataset.receipt ?? null })) };

  })();
  return {current,dom};
}
function hasCombatReveal(current) {
  return current.phase==='combat' && current.m8.loot.direct.some(drop=>drop.status==='revealed');
}
module.exports={lootPanelSnapshot,hasCombatReveal};
