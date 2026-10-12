import test from 'node:test';
import assert from 'node:assert/strict';
import {initialShell,contextFor,changeContext,mapTransfer,routeQuery,screenKey,firstVisitContext,acceptPrototypeRevision} from '../src/app/shell-state.js';
import {applyParticipantIntent,emptyFilters} from '../src/files/map-query.js';
const years=[2020,2021,2022,2023,2024,2025];
test('Shell defaults to overview/latest catalog year, restores independent screen preferences and rejects unsupported input',()=>{
 const initial=initialShell('',years,{contexts:{map:{year:2024,region:5},time:{from:2020,to:2023,group:'rad',region:11}},budget:100});
 assert.equal(initial.screen,'overview');assert.equal(initial.contexts.overview.year,2025);assert.deepEqual(initial.contexts.map,{region:5,year:2024});
 assert.equal(initial.contexts.time.group,'rad');assert.equal(initial.contexts.time.from,2020);assert.equal(initial.contexts.severity.group,'all');
 assert.equal(screenKey('constructor'),'overview');assert.deepEqual(contextFor('map',{region:99,year:2019,group:'pkw',month:[1]},years),{region:0,year:2025});
});
test('Period controls clamp counterpart instead of losing user-selected boundary',()=>{
 const context=contextFor('time',{region:5,from:2020,to:2022,group:'pkw'},years);
 assert.equal(changeContext('time',context,'from','2024',years).to,2024);
 assert.equal(changeContext('time',context,'to','2020',years).from,2020);
 assert.equal(changeContext('time',context,'region','11',years).group,'pkw');
});
test('Explicit analytics-to-map transfer takes end year and only supported fields',()=>{
 const transfer=mapTransfer({region:5,from:2020,to:2024,year:2025,group:'rad',road:'wet'},years);
 assert.deepEqual(transfer,{region:5,year:2024,group:'rad'});
 assert.equal(mapTransfer({group:'malformed'},years).group,null);
 assert.equal(mapTransfer({region:0,year:2025},years).year,2025);
});
test('Route URL round trip retains context, excludes map-only combinations from analytics',()=>{
 const context=contextFor('severity',{region:8,from:2020,to:2024,group:'other_participant'},years);
 const restored=initialShell(routeQuery('severity',context),years);
 assert.equal(restored.screen,'severity');assert.deepEqual(restored.contexts.severity,context);
 assert.equal(restored.contexts.map.year,2025);
});
test('Explicit participant intent resets groups only and preserves other map filters',()=>{
 const filters={...emptyFilters(),pkw:0,rad:1,month:[1,2],light:[2]};
 const next=applyParticipantIntent(filters,'fuss');assert.equal(next.pkw,null);assert.equal(next.rad,null);assert.equal(next.fuss,1);
 assert.deepEqual(next.month,[1,2]);assert.deepEqual(next.light,[2]);assert.equal(applyParticipantIntent(next,'all').fuss,null);
 assert.throws(()=>applyParticipantIntent(filters,'unknown'));
});

test('First visit inherits territory and terminal year, without guessing participant combinations',()=>{
 const source={region:5,year:2025,from:2020,to:2024,group:'pkw'};
 assert.deepEqual(firstVisitContext('map',source,years),{region:5,year:2024});
 assert.deepEqual(firstVisitContext('severity',source,years),{region:5,year:2024,from:2024,to:2024,group:'all'});
});

test('Prototype bridge rejects old, missing and future revisions',()=>{
 assert.equal(acceptPrototypeRevision(4,4),true);for(const v of [3,5,null,undefined,'4'])assert.equal(acceptPrototypeRevision(v,4),false);
});
test('Remembered screens remain separate from frames mounted in the current page',()=>{
 const state=initialShell('',years,{seen:['map','time','unknown'],contexts:{map:{region:5,year:2024}}});
 assert.deepEqual(state.seen,['map','time']);assert.equal(state.screen,'overview');assert.equal(state.contexts.map.year,2024);
});
