import {emptyFilters,validateMapFilters,allHours} from './map-query.js';
export function decodeMapFilters(value){if(!value)return null;const payload=JSON.parse(value);if(payload.v!==2)throw new Error('Версия ссылки на отбор не поддерживается');validateMapFilters(payload.filters);return {...emptyFilters(),...payload.filters};}
export function migrateMapFilters(saved,legacy=false){validateMapFilters(saved);return {...emptyFilters(),...saved,...(legacy&&!saved.hour?.length?{hour:[...allHours]}:{})};}
export function mapSelectionLink(base,year,region,filters){validateMapFilters(filters);const url=new URL(base);url.search=new URLSearchParams({screen:'map',region:String(region),year:String(year),mf:JSON.stringify({v:2,filters})}).toString();url.hash='';return url.href;}
