export const classes = {
  panel:           'hidden xl:flex flex-col flex-1 border-l border-[#30363d] min-w-0 bg-[#0d1117]',
  panelHead:       'flex items-center justify-between px-4 py-[4px] border-b border-[#30363d] shrink-0',
  panelTitle:      'text-white font-bold text-sm',
  panelCount:      'text-[#6e7681] text-xs',
  collapseStrip:   'hidden xl:flex flex-col w-9 shrink-0 border-l border-[#30363d] items-center justify-start pt-3 bg-[#0d1117] cursor-pointer hover:bg-[#161b22] transition-colors select-none',
  // Fixed-size cards that fill vertically, then scroll horizontally — consistent
  // with the preset cards and the Recent tab's active items.
  // Taller cards so they fill the column height: 160px normal (footer hidden →
  // more room), 144px in edit mode (footer visible).
  panelGrid: (editing: boolean) => editing
    ? 'grid grid-flow-col [grid-template-rows:repeat(auto-fill,144px)] [grid-auto-columns:200px] gap-2 p-2 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-dark'
    : 'grid grid-flow-col [grid-template-rows:repeat(auto-fill,160px)] [grid-auto-columns:200px] gap-2 p-2 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-dark',
  // Label-preview card style — bigger cards that show a true-to-print preview.
  // Slightly taller than the standard cards so the label preview has room while
  // still fitting 3 rows. Always a grid (mirrors the left-column preset cards).
  panelGridLabel: (editing: boolean) => editing
    ? 'grid grid-flow-col [grid-template-rows:repeat(auto-fill,150px)] [grid-auto-columns:200px] gap-2 p-2 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-dark'
    : 'grid grid-flow-col [grid-template-rows:repeat(auto-fill,166px)] [grid-auto-columns:200px] gap-2 p-2 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-dark',
  labelCard:       'relative flex flex-col border border-[#30363d] rounded-lg bg-[#0d1117] overflow-hidden',
  gridCard:        'flex flex-col border border-[#30363d] rounded-lg bg-[#0d1117] overflow-hidden',
  gridCardHead:    'flex items-center gap-1 px-2 pt-2 pb-0',
  gridCardMeta:    'px-2 pb-1 text-[#6e7681] text-[11px] truncate',
  gridCardBtns:    'flex gap-1 px-2 pb-2 pt-1 mt-auto',
  gridCardBtn:     (green: boolean) => `flex-1 min-h-[40px] text-xs font-bold rounded border cursor-pointer disabled:opacity-60 transition-colors ${green ? 'border-[#28a745] bg-[#28a745] text-white hover:bg-[#2ea043]' : 'border-[#30363d] bg-[#161b22] text-white hover:border-[#6e7681]'}`,
  gridCardIconBtn: 'shrink-0 w-7 h-7 flex items-center justify-center rounded bg-transparent border-0 cursor-pointer transition-colors',
  gridCardIconBtnSm: 'shrink-0 w-6 h-6 flex items-center justify-center rounded bg-transparent border-0 cursor-pointer transition-colors',
  panelTabBar:     'flex border-b border-[#30363d] shrink-0',
  panelTab:        (active: boolean) => active
    ? 'flex-1 py-[9px] text-xs font-bold text-white border-b-2 border-[#28a745] bg-transparent cursor-pointer transition-colors'
    : 'flex-1 py-[9px] text-xs font-bold text-[#6e7681] border-b-2 border-transparent bg-transparent cursor-pointer hover:text-[#adbac7] transition-colors',
  panelList:       'flex-1 min-h-0 overflow-y-auto scrollbar-dark',
  emptyState:      'flex flex-col items-center justify-center h-full w-full gap-2 text-[#6e7681] text-sm text-center px-6',
  itemRow:         'flex items-center gap-2 px-3 py-[10px] border-b border-[#30363d] group hover:bg-[#161b22] transition-colors',
  itemInfo:        'flex-1 min-w-0',
  itemName:        'text-white text-sm font-medium leading-snug truncate',
  itemDur:         'text-[#6e7681] text-xs mt-[2px]',
  itemBtn:         (green: boolean) => `shrink-0 px-3 py-[6px] text-xs font-bold rounded border cursor-pointer disabled:opacity-60 ${green ? 'border-[#28a745] bg-[#28a745] text-white' : 'border-[#30363d] bg-[#0d1117] text-white'}`,
  itemDelBtn:      'shrink-0 bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#f85149] text-base leading-none px-1 opacity-0 group-hover:opacity-100 transition-opacity',
  itemEditBtn:     'shrink-0 bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#58a6ff] leading-none px-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center',
  bundleBadge:     'inline-block shrink-0 px-[5px] py-[1px] rounded text-[9px] font-bold text-[#8b949e] bg-[#21262d] border border-[#30363d] mr-[5px]',
  catBadge:        'inline-block shrink-0 px-[5px] py-[1px] rounded text-[9px] font-bold border mr-[5px]',
  filterPill:      (active: boolean) => active
    ? 'px-2 py-[3px] rounded text-[10px] font-bold cursor-pointer border border-[#28a745] bg-[#28a745] text-white transition-colors'
    : 'px-2 py-[3px] rounded text-[10px] font-bold cursor-pointer border border-[#30363d] bg-transparent text-[#6e7681] hover:text-white hover:border-[#6e7681] transition-colors',
  recentRow:       'flex items-center gap-3 px-3 py-[10px] border-b border-[#30363d] group hover:bg-[#161b22] transition-colors',
  recentBadge:     'shrink-0 w-8 h-8 rounded bg-[#21262d] border border-[#30363d] text-white text-[10px] font-bold flex items-center justify-center',
  recentInfo:      'flex-1 min-w-0',
  recentMain:      'text-white text-sm font-medium',
  recentSub:       'text-[#6e7681] text-xs mt-[1px]',
  recentBtn:       'shrink-0 px-2 py-1 text-xs font-bold rounded border border-[#30363d] bg-[#0d1117] text-[#adbac7] cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100',
  addForm:         'shrink-0 border-t border-[#30363d] p-3 flex flex-col gap-[6px]',
  addBtn:          'flex-1 py-2 border-0 rounded bg-[#28a745] text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
}
