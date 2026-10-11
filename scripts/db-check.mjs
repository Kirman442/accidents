
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const settings=fs.readFileSync(new URL('../data/uad_settings.txt',import.meta.url),'utf8');
const connection=new URL(settings.split(/\r?\n/).find(line=>line.startsWith('postgres')));
const expected='db.fiambamorokfphkzdjxc.supabase.co';
if(connection.hostname!==expected) throw new Error('Unexpected target database host');
const env={...process.env,PGHOST:connection.hostname,PGPORT:connection.port||'5432',PGUSER:decodeURIComponent(connection.username),PGPASSWORD:decodeURIComponent(connection.password),PGDATABASE:connection.pathname.slice(1),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'10'};
const result=spawnSync('J:/Program Files/PostgreSQL/16/bin/psql.exe',['-X','-v','ON_ERROR_STOP=1','-c',"SELECT current_database(), version(); SELECT tablename FROM pg_tables WHERE schemaname='public';"],{env,encoding:'utf8'});
console.log(result.stdout); console.log((result.stderr||'').replaceAll(env.PGPASSWORD,'[REDACTED]')); if(result.error) throw result.error; process.exitCode=result.status ?? 1;
