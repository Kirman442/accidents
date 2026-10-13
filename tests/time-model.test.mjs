import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTime,timeCalendar,timeSummary,timeDayCells,timeValue,timeYears,timeGroups} from '../src/app/time-model.js';
const data=JSON.parse(readFileSync(new URL('../public/analytics/time.json',import.meta.url),'utf8'));
const overview=JSON.parse(readFileSync(new URL('../public/analytics/overview.json',import.meta.url),'utf8'));
test('all time groups reconcile with independently prepared overview for every region and year',()=>{
  assert.equal(validateTime(data,overview.generation),data);
  for(const year of timeYears)for(let region=0;region<=16;region++)for(const group of timeGroups){const expected=region?overview.years[year].lands[region]:overview.years[year].national;assert.equal(data.years[year][region][group].count,group==='all'?expected.count:expected.participation[group]);}
});
test('calendar uses actual weekday occurrences and leap February, not five/seven shortcuts',()=>{
  const calendar=timeCalendar(timeYears);assert.equal(calendar.total,2192);assert.equal(calendar.weekday[0],313);assert.equal(timeCalendar([2024]).month[1],29);
  const s=timeSummary(data,timeYears,2,'all');assert.equal(s.count,41087);const cells=timeDayCells(s,calendar,'daily',{mode:'periods'});assert.equal(cells.cells[0].raw,199);assert.equal(cells.cells[0].value,199/313);
});
test('local day/hour filters preserve period-wide share denominator and exact source sums',()=>{
  const s=timeSummary(data,timeYears,2,'all'),c=timeCalendar(timeYears),all=timeDayCells(s,c,'count',{mode:'periods'});
  assert.equal(all.cells.reduce((n,r)=>n+r.raw,0),s.count);
  const selected=timeDayCells(s,c,'share',{mode:'periods',day:'weekend',period:'0'});assert.equal(selected.cells.length,2);for(const cell of selected.cells)assert.equal(cell.value,cell.raw/s.count*100);assert.equal(s.count,41087);
  assert.equal(timeValue(426,29,7031,'daily'),426/29);assert.equal(timeValue(426,29,7031,'share'),426/7031*100);
});
test('time validation rejects altered generation, missing groups and inconsistent joint cells',()=>{
  assert.throws(()=>validateTime(data,'wrong'));
  for(const mutate of [d=>delete d.years[2020][2].pkw,d=>d.years[2024][0].all.weekhour[0]++,d=>d.years[2025][2].all.month.pop()]){const bad=structuredClone(data);mutate(bad);assert.throws(()=>validateTime(bad,overview.generation));}
});
