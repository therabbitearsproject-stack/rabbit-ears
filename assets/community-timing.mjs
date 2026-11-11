/* The watch-party clock excludes removed tape sections and inserted adverts. */
export function contentPosition(sourceTime,cuts){
  if(!cuts?.length)return sourceTime;
  let elapsed=0;
  for(const [from,to] of cuts){
    if(sourceTime>=from&&sourceTime<=to)return elapsed+sourceTime-from;
    elapsed+=to-from;
  }
  return null;
}
export function editionFile(file,cuts){return cuts?.length?file+'#rabbit-ears-edit='+JSON.stringify(cuts):file;}
