export const classes = {
  page:             'flex flex-col h-full bg-[#0d1117]',
  contentRow:       'flex flex-1 min-h-0',
  leftCol:          'relative flex flex-col flex-1 xl:flex-none min-w-0',
  leftTabBar:       'flex border-b border-[#30363d] shrink-0',
  leftTab:          (active: boolean) => active
    ? 'flex-1 py-[10px] text-sm font-bold text-white border-b-2 border-[#28a745] bg-transparent cursor-pointer transition-colors'
    : 'flex-1 py-[10px] text-sm font-bold text-[#6e7681] border-b-2 border-transparent bg-transparent cursor-pointer hover:text-[#adbac7] transition-colors',
  leftCollapseStrip:'hidden xl:flex flex-col w-9 shrink-0 border-r border-[#30363d] items-center justify-start pt-3 bg-[#0d1117] cursor-pointer hover:bg-[#161b22] transition-colors select-none',
  selector:         'flex shrink-0',
  tmplBtn:          (active: boolean) => {
    const fill = active ? 'bg-[#28a745] text-white' : 'bg-transparent text-[#28a745]'
    return `flex-1 py-3 min-h-[52px] text-[1.05rem] font-bold border-b-2 border-[#28a745] cursor-pointer disabled:opacity-60 ${fill}`
  },
  newBtn:           'px-3 py-3 min-h-[52px] text-sm font-bold text-[#28a745] border-b-2 border-[#28a745] bg-transparent cursor-pointer shrink-0 hover:bg-[#28a745]/10 transition-colors',
  sortSelect:       'px-3 py-3 min-h-[52px] text-sm font-bold text-[#6e7681] border-b-2 border-[#30363d] bg-[#0d1117] cursor-pointer shrink-0 outline-none hover:text-white transition-colors',
  editBtn:          (active: boolean) => active
    ? 'px-4 py-3 min-h-[52px] text-sm font-bold text-white border-b-2 border-[#28a745] bg-[#28a745] cursor-pointer shrink-0'
    : 'px-4 py-3 min-h-[52px] text-sm font-bold text-[#6e7681] border-b-2 border-[#30363d] hover:text-white hover:border-[#6e7681] bg-transparent cursor-pointer transition-colors shrink-0',
  cardsRow:         'grid grid-flow-col grid-rows-[auto] tall:grid-rows-[auto_auto] xtall:grid-rows-[auto_auto_auto] [grid-auto-columns:220px] content-center overflow-x-auto overflow-y-hidden flex-1 min-h-0 gap-3 px-3 pt-3 pb-3 scrollbar-dark',
  editRow:          'grid grid-flow-col grid-rows-[auto] tall:grid-rows-[auto_auto] xtall:grid-rows-[auto_auto_auto] [grid-auto-columns:220px] content-center overflow-x-auto overflow-y-hidden flex-1 min-h-0 gap-3 px-3 pt-3 pb-3 scrollbar-dark',
  card:             'relative h-[210px] bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden flex flex-col',
  cardHead:         'text-center py-[6px] px-3 border-b border-[#30363d] text-white text-base font-bold tracking-wide shrink-0',
  cardBody:         'bg-[#090c10] p-3 flex flex-col gap-2 flex-1 min-h-0',
  btnRow:           'flex gap-2',
  btn5:             'flex-1 min-h-[44px] border border-[#30363d] rounded-lg bg-[#161b22] text-white text-sm font-bold disabled:opacity-60',
  btnX:             'flex-1 min-h-[44px] border border-[#28a745] rounded-lg bg-[#28a745] text-white text-sm font-bold disabled:opacity-60',
  divider:          'hidden xl:flex w-[8px] shrink-0 cursor-col-resize touch-none items-center justify-center hover:bg-[#28a745]/10 select-none transition-colors',
  dividerBar:       'w-[2px] h-12 rounded-full bg-[#30363d]',
}
