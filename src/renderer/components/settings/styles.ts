// Shared Tailwind class strings for settings tabs. Centralised so every tab —
// current and future — uses the same buttons, inputs and labels.
export const ui = {
  // Buttons
  primaryBtn:   'px-5 py-2 rounded-lg bg-[#28a745] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#2ea043] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  secondaryBtn: 'px-4 py-2 rounded-lg bg-transparent border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  neutralBtn:   'px-4 py-2 rounded-lg bg-[#21262d] border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  dangerBtn:    'px-5 py-2 rounded-lg bg-transparent border border-[#f85149] text-[#f85149] text-sm font-bold cursor-pointer hover:bg-[#f85149] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  dangerSolid:  'px-4 py-2 rounded-lg bg-[#f85149] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#da3633] transition-colors',
  blueBtn:      'px-5 py-2 rounded-lg bg-[#1f6feb] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#388bfd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',

  // Inputs
  input:      'w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-[9px] text-white text-sm outline-none focus:border-[#28a745] placeholder:text-[#484f58]',
  fieldLabel: 'text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-1',

  // Layout helpers
  sectionLabel: 'text-[#6e7681] text-[11px] font-semibold uppercase tracking-widest mb-2',
  actionRow:    'flex gap-2 flex-wrap items-center',
  stat:         'text-[#adbac7] text-sm',
  statNum:      'text-white font-bold',
  note:         'text-[#6e7681] text-xs leading-relaxed bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2',
  mono:         'font-mono text-[#adbac7] bg-[#161b22] px-1 py-[1px] rounded text-[11px]',
}
