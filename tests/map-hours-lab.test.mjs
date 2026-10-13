import test from 'node:test';
import assert from 'node:assert/strict';
import {rowState,selectRow,dragHours,hourRanges,describeHours} from '../src/files/hours-selection.js';
test('hour gestures span chronological hours across rows, add disjoint ranges and remove without mutating the base',()=>{const base=new Set([16,17,18]),next=dragHours(base,4,8,true);assert.deepEqual([...next].sort((a,b)=>a-b),[4,5,6,7,8,16,17,18]);assert.deepEqual([...base],[16,17,18]);assert.deepEqual(hourRanges(dragHours(next,8,6,false)),[[4,5],[16,18]]);});
test('partial row fills all six hours, full row clears only that row and hour labels include the last hour',()=>{const partial=new Set([7,8,22]);assert.equal(rowState(partial,6),'mixed');const filled=selectRow(partial,6);assert.equal(rowState(filled,6),'true');assert.deepEqual([...selectRow(filled,6)],[22]);assert.equal(describeHours(new Set([7,8,9,16,17,18])),'07:00–09:59 и 16:00–18:59');assert.equal(describeHours(new Set()),'Часы не выбраны');});
