export default function FilterIcon({kind}){
  if(kind==='participants')return <span className="participant-filter-symbols" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22v-6l5-2 4-6h9l5 7 3 2v5h-4m-18 0H3m10 0h6M8 14h18M16 8v6"/><circle cx="10" cy="22" r="3"/><circle cx="22" cy="22" r="3"/></svg><svg width="25" height="25" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="17" cy="5" r="3"/><path d="M15 10l-3 9 6 5 1 6M12 19l-7 10m10-18 7 6 7 1M14 12l-8 5"/></svg></span>;
  if(kind==='accident_type')return <svg width="25" height="25" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 22v-9l2-5h7l2 5v9H2m0-8h11m-9 4h2m3 0h2M19 22v-9l2-5h7l2 5v9H19m0-8h11m-9 4h2m3 0h2M5 22v3m5-3v3m12-3v3m5-3v3M16 10v4m0 4v1m-1-13 1-3 1 3"/></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==='participants'?<><path d="M2 19v-5l3-4h7l2 4v5H2m0-5h12"/><circle cx="5" cy="19" r="1.5"/><circle cx="11" cy="19" r="1.5"/><circle cx="19" cy="4" r="2"/><path d="m19 7-2 6 3 3 1 6m-4-9-2 8m4-13 3 3"/></>:
    kind==='hour'?<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/></>:
    kind==='month'?<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18m-13 4h3m3 0h3m-9 4h3"/></>:
    kind==='weekday'?<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M5 12v5m2-5v5m2-5v5m2-5v5m2-5v5m4-5v5m2-5v5"/></>:
    kind==='category'?<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>:
    kind==='light'?<><circle cx="8" cy="12" r="4"/><path d="M8 4v2m0 12v2M1 12h1m1-5 1 1m-1 9 1-1M20 5a7 7 0 1 0 1 14 8 8 0 0 1-1-14Z"/></>:
    kind==='road_condition'?<><path d="M7 2 3 22m14-20 4 20M12 3v4m0 3v4m0 3v4"/></>:
    kind==='accident_pattern'?<><path d="M12 22V12L5 5m7 7 7-7M2 5h5V2m10 0v5h5"/></>:
    <><path d="M2 17v-5l3-4h5l2 4v5H2m10 0v-5l3-4h5l2 4v5H12M2 12h10m0 0h10"/><circle cx="5" cy="18" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/><circle cx="19" cy="18" r="1.5"/></>}
  </svg>;
}
