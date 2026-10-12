import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overviewStats,overviewComparison,overviewTrend,overviewChange} from '../src/app/overview-model.js';
const data=JSON.parse(readFileSync(new URL('../public/analytics/overview.json',import.meta.url),'utf8'));
test('native overview reconciles all categories and fleet endpoints for every region/year',()=>{
  for(const year of [2020,2021,2022,2023,2024,2025])for(let region=0;region<=16;region++){
    const row=overviewStats(data,year,region);
    assert.equal(row.severity,(row.category[0]+row.category[1])/row.count*100);
    assert.equal(row.rate,row.participation.pkw/((row.begin+row.end)/2)*10000);
  }
  assert.equal(overviewStats(data,2025,2).count,7057);
  assert.equal(overviewComparison(data,2025,'count')[0].land,5);
  assert.equal(overviewComparison(data,2025,'rate')[0].land,11);
});
test('regional count line uses common baseline while bars preserve absolute incident counts',()=>{
  const line=overviewTrend(data,2,'count','line');
  assert.equal(line.index,true);assert.equal(line.selected[0].value,100);assert.equal(line.national[0].value,100);
  assert.equal(line.selected.at(-1).value,7057/data.years[2020].lands[2].count*100);
  const bars=overviewTrend(data,2,'count','bars');assert.equal(bars.index,false);assert.equal(bars.national,null);assert.equal(bars.selected.at(-1).value,7057);
  const country=overviewTrend(data,0,'count','line');assert.equal(country.index,false);assert.equal(country.national,null);assert.equal(country.selected.at(-1).value,273007);
});
test('missing or zero previous denominator never produces fabricated year-over-year growth',()=>{
  assert.equal(overviewChange(20,null),null);assert.equal(overviewChange(null,20),null);assert.equal(overviewChange(20,0),null);
  assert.equal(overviewChange(0,20),-100);assert.equal(overviewChange(20,10),100);assert.equal(overviewChange(8,10,true),-2);
});
