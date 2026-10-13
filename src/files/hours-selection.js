export const hourPeriods=[['Ночь',0],['Утро',6],['День',12],['Вечер',18]];
export function rowState(selected,start){const count=Array.from({length:6},(_,i)=>start+i).filter(h=>selected.has(h)).length;return count===6?'true':count===0?'false':'mixed';}
export function selectRow(selected,start){const next=new Set(selected),enable=rowState(selected,start)!=='true';for(let h=start;h<start+6;h++)enable?next.add(h):next.delete(h);return next;}
export function dragHours(selected,start,end,enable){const next=new Set(selected);for(let h=Math.min(start,end);h<=Math.max(start,end);h++)enable?next.add(h):next.delete(h);return next;}
export function hourRanges(selected){const hours=[...selected].sort((a,b)=>a-b),ranges=[];for(const h of hours){const last=ranges.at(-1);if(last&&h===last[1]+1)last[1]=h;else ranges.push([h,h]);}return ranges;}
export function describeHours(selected){const two=h=>String(h).padStart(2,'0');return selected.size===24?'Все сутки · 00:00–23:59':selected.size?hourRanges(selected).map(([a,b])=>two(a)+':00–'+two(b)+':59').join(' и '):'Часы не выбраны';}
