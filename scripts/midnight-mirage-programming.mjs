import {strengthenPool} from './program-quality.mjs';

// Explicitly reviewed files are durable programming inputs, not a broad title search.
// Keeping their parent Archive item IDs preserves report/block and subtitle matching.
export function midnightMirageRows(library) {
  if(library.id!=='midnight-mirage-v1'||!Array.isArray(library.rows))throw Error('Invalid Midnight Mirage film library');
  const rows=library.rows.filter(row=>Array.isArray(row)&&typeof row[0]==='string'&&row[0]&&
    typeof row[1]==='string'&&/\.mp4$/i.test(row[1])&&typeof row[3]==='string'&&row[3]&&
    typeof row[6]==='string'&&row[6]&&Number.isFinite(row[2])&&row[2]>0);
  const approved=strengthenPool({name:'Midnight Mirage'},rows);
  if(!approved.length)throw Error('No approved full films for Midnight Mirage');
  return approved;
}
