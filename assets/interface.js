/* Presentation layer. The existing schedule, video, radio and game engines retain ownership. */
(() => {
  const skins = [
    ['retro','Retro Cabinet','Walnut, chrome and tactile television dials.','#765038'],
    ['theatre','Movie Theatre','Velvet curtains and a dark auditorium.','#742739'],
    ['stadium','Stadium Seat','Field stripes and a broadcast scoreboard.','#31583f'],
    ['modern','Silver Screen','Brushed aluminium and a quiet modern setting.','#a6afb7'],
    ['cozy','Cozy Den','Warm wood and soft evening lamplight.','#b48d61'],
    ['metal','Midnight Metal','Black steel, red stage lights and loud type.','#b51d32'],
    ['ivory','Ivory Console','Enamel, burgundy and an easy-to-read guide.','#e6d8bf'],
  ];
  const paths={tv:'M4 7h16v13H4z M8 3l4 4 4-4',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',radio:'M5 9h14v11H5z M7 9l11-6 M8 13h8 M8 16h2 M14 16h2',game:'M7 7h10l4 5v7h-4l-3-3h-4l-3 3H3v-7z M6 11v4 M4 13h4 M16 11h.1 M18 14h.1',palette:'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4 2 2 0 0 1 0-4h3a4 4 0 0 0 4-4c0-4-5-6-9-6 M7 8h.1 M6 13h.1 M11 6h.1 M16 8h.1',play:'M8 4l12 8-12 8z',pause:'M8 5v14 M16 5v14',up:'M5 15l7-7 7 7',down:'M5 9l7 7 7-7',full:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',exit:'M3 8h5V3 M21 8h-5V3 M3 16h5v5 M21 16h-5v5',back:'M11 5l-7 7 7 7 M4 12h16',sound:'M4 9h4l5-4v14l-5-4H4z M17 8q5 4 0 8',mute:'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',rewind:'M8 4L3 9l5 5 M3 9h10a7 7 0 1 1-7 11',forward:'M16 4l5 5-5 5 M21 9H11a7 7 0 1 0 7 11',share:'M9 7l6 5-6 5 M15 12H3 M14 4h7v16h-7',flag:'M5 21V3l14 3-5 6H5',shuffle:'M3 5h3l12 14h3 M18 16l3 3-3 3 M3 19h3l4-5 M14 9l4-4h3 M18 2l3 3-3 3',cc:'M10 8H6v8h4 M20 8h-4v8h4',close:'M5 5l14 14 M19 5L5 19',heart:'M12 21S2 14 2 7a5 5 0 0 1 10-2A5 5 0 0 1 22 7c0 7-10 14-10 14'};
  const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[n]||paths.tv}"/></svg>`;
  const make=(tag,cls,text)=>Object.assign(document.createElement(tag),{className:cls||'',textContent:text||''});
  const button=(label,fn,cls='btn')=>{const b=make('button',cls,label);b.type='button';b.onclick=fn;return b;};
  const donate=()=>{const a=make('a','archive-donate','Support the Internet Archive ↗');a.href='https://archive.org/donate';a.target='_blank';a.rel='noopener';return a;};
  let logos={}, guideScroll=0, guideFocus=null, idleTimer, dialogOpener, channelNo, scheduleToken=0;
  let full=false, radioLook=store.get('re_radio_look','vinyl');
  const body=document.body, tv=$('tvView'), screen=$('screen');
  const initialChannel=/^#ch\d+$/.test(location.hash);
  const skin=store.get('re_skin','retro');
  body.dataset.skin=skins.some(s=>s[0]===skin)?skin:'retro';
  body.dataset.tvPage=initialChannel?'channel':'guide';
  body.dataset.radioLook=radioLook==='car'?'car':'vinyl';
  function station(ch,compact=false){
    const el=make('span','channel-identity'+(compact?' compact':''));
    const info=logos[ch.name];
    el.append(make('span','channel-no',String(ch.no).padStart(2,'0')));
    const mat=make('span','logo-mat');
    if(info){el.style.setProperty('--channel-accent',info.accent);const im=make('img','channel-logo');im.src=info.src;im.alt=ch.name;im.width=180;im.height=100;im.decoding='async';mat.append(im);}
    else mat.append(make('span','channel-name',ch.name));
    el.append(mat);return el;
  }
  const wordmark=()=>'<span class="site-wordmark"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 122"  fill="currentColor" aria-hidden="true"><path transform="translate(16 101) scale(1.048675 1)" d="M9.3438-7.3672L9.3438 0L3.0322 0L3.0322-23.8535L8.8945-23.8535L8.8945-20.4619Q10.3994-22.8652 11.6011-23.6289Q12.8027-24.3926 14.3301-24.3926Q16.4863-24.3926 18.4854-23.2021L16.5313-17.6992Q14.9365-18.7324 13.5664-18.7324Q12.2412-18.7324 11.3203-18.0024Q10.3994-17.2725 9.8716-15.3633Q9.3438-13.4541 9.3438-7.3672M25.9199-16.5762L20.1924-17.6094Q21.1582-21.0684 23.5166-22.7305Q25.8750-24.3926 30.5244-24.3926Q34.7471-24.3926 36.8135-23.3931Q38.8799-22.3936 39.7222-20.8550Q40.5645-19.3164 40.5645-15.2061L40.4971-7.8389Q40.4971-4.6943 40.8003-3.2007Q41.1035-1.7070 41.9346 0L35.6904 0Q35.4434-0.6289 35.0840-1.8643Q34.9268-2.4258 34.8594-2.6055Q33.2422-1.0332 31.4004-0.2471Q29.5586 0.5391 27.4697 0.5391Q23.7861 0.5391 21.6636-1.4600Q19.5410-3.4590 19.5410-6.5137Q19.5410-8.5352 20.5068-10.1187Q21.4727-11.7021 23.2134-12.5444Q24.9541-13.3867 28.2334-14.0156Q32.6582-14.8467 34.3652-15.5654L34.3652-16.1943Q34.3652-18.0137 33.4668-18.7886Q32.5684-19.5635 30.0752-19.5635Q28.3906-19.5635 27.4473-18.9009Q26.5039-18.2383 25.9199-16.5762M34.3652-10.1973L34.3652-11.4551Q33.1523-11.0508 30.5244-10.4893Q27.8965-9.9277 27.0879-9.3887Q25.8525-8.5127 25.8525-7.1650Q25.8525-5.8398 26.8408-4.8740Q27.8291-3.9082 29.3564-3.9082Q31.0635-3.9082 32.6133-5.0312Q33.7588-5.8848 34.1182-7.1201Q34.3652-7.9287 34.3652-10.1973M52.3789 0L46.5166 0L46.5166-32.9277L52.8281-32.9277L52.8281-21.0684Q55.7480-24.3926 59.7461-24.3926Q64.1035-24.3926 66.9561-21.2368Q69.8086-18.0811 69.8086-12.1738Q69.8086-6.0645 66.8999-2.7627Q63.9912 0.5391 59.8359 0.5391Q57.7920 0.5391 55.8042-0.4829Q53.8164-1.5049 52.3789-3.5039L52.3789 0M52.7832-12.4434Q52.7832-8.7373 53.9512-6.9629Q55.5908-4.4473 58.3086-4.4473Q60.3975-4.4473 61.8687-6.2329Q63.3398-8.0186 63.3398-11.8594Q63.3398-15.9473 61.8574-17.7554Q60.3750-19.5635 58.0615-19.5635Q55.7930-19.5635 54.2881-17.8003Q52.7832-16.0371 52.7832-12.4434M80.4775 0L74.6152 0L74.6152-32.9277L80.9268-32.9277L80.9268-21.0684Q83.8467-24.3926 87.8447-24.3926Q92.2021-24.3926 95.0547-21.2368Q97.9072-18.0811 97.9072-12.1738Q97.9072-6.0645 94.9985-2.7627Q92.0898 0.5391 87.9346 0.5391Q85.8906 0.5391 83.9028-0.4829Q81.9150-1.5049 80.4775-3.5039L80.4775 0M80.8818-12.4434Q80.8818-8.7373 82.0498-6.9629Q83.6895-4.4473 86.4072-4.4473Q88.4961-4.4473 89.9673-6.2329Q91.4385-8.0186 91.4385-11.8594Q91.4385-15.9473 89.9561-17.7554Q88.4736-19.5635 86.1602-19.5635Q83.8916-19.5635 82.3867-17.8003Q80.8818-16.0371 80.8818-12.4434M109.2949-27.0879L102.9834-27.0879L102.9834-32.9277L109.2949-32.9277L109.2949-27.0879M109.2949 0L102.9834 0L102.9834-23.8535L109.2949-23.8535L109.2949 0M122.3896-23.8535L126.7021-23.8535L126.7021-18.8223L122.3896-18.8223L122.3896-9.2090Q122.3896-6.2891 122.5132-5.8062Q122.6367-5.3232 123.0747-5.0088Q123.5127-4.6943 124.1416-4.6943Q125.0176-4.6943 126.6797-5.3008L127.2188-0.4043Q125.0176 0.5391 122.2324 0.5391Q120.5254 0.5391 119.1553-0.0337Q117.7852-0.6064 117.1450-1.5161Q116.5049-2.4258 116.2578-3.9756Q116.0557-5.0762 116.0557-8.4229L116.0557-18.8223L113.1582-18.8223L113.1582-23.8535L116.0557-23.8535L116.0557-28.5928L122.3896-32.2764"/><path transform="translate(198 101) scale(1.098780 1)" d="M17.1152-7.5918L23.4043-6.5361Q22.1914-3.0771 19.5747-1.2690Q16.9580 0.5391 13.0273 0.5391Q6.8057 0.5391 3.8184-3.5264Q1.4600-6.7832 1.4600-11.7471Q1.4600-17.6768 4.5596-21.0347Q7.6592-24.3926 12.3984-24.3926Q17.7217-24.3926 20.7988-20.8774Q23.8760-17.3623 23.7412-10.1074L7.9287-10.1074Q7.9961-7.2998 9.4561-5.7388Q10.9160-4.1777 13.0947-4.1777Q14.5771-4.1777 15.5879-4.9863Q16.5986-5.7949 17.1152-7.5918M8.0410-13.9707L17.4746-13.9707Q17.4072-16.7109 16.0596-18.1372Q14.7119-19.5635 12.7803-19.5635Q10.7139-19.5635 9.3662-18.0586Q8.0186-16.5537 8.0410-13.9707M33.6016-16.5762L27.8740-17.6094Q28.8398-21.0684 31.1982-22.7305Q33.5566-24.3926 38.2061-24.3926Q42.4287-24.3926 44.4951-23.3931Q46.5615-22.3936 47.4038-20.8550Q48.2461-19.3164 48.2461-15.2061L48.1787-7.8389Q48.1787-4.6943 48.4819-3.2007Q48.7852-1.7070 49.6162 0L43.3721 0Q43.1250-0.6289 42.7656-1.8643Q42.6084-2.4258 42.5410-2.6055Q40.9238-1.0332 39.0820-0.2471Q37.2402 0.5391 35.1514 0.5391Q31.4678 0.5391 29.3452-1.4600Q27.2227-3.4590 27.2227-6.5137Q27.2227-8.5352 28.1885-10.1187Q29.1543-11.7021 30.8950-12.5444Q32.6357-13.3867 35.9150-14.0156Q40.3398-14.8467 42.0469-15.5654L42.0469-16.1943Q42.0469-18.0137 41.1484-18.7886Q40.2500-19.5635 37.7568-19.5635Q36.0723-19.5635 35.1289-18.9009Q34.1855-18.2383 33.6016-16.5762M42.0469-10.1973L42.0469-11.4551Q40.8340-11.0508 38.2061-10.4893Q35.5781-9.9277 34.7695-9.3887Q33.5342-8.5127 33.5342-7.1650Q33.5342-5.8398 34.5225-4.8740Q35.5107-3.9082 37.0381-3.9082Q38.7451-3.9082 40.2949-5.0312Q41.4404-5.8848 41.7998-7.1201Q42.0469-7.9287 42.0469-10.1973M60.5098-7.3672L60.5098 0L54.1982 0L54.1982-23.8535L60.0605-23.8535L60.0605-20.4619Q61.5654-22.8652 62.7671-23.6289Q63.9688-24.3926 65.4961-24.3926Q67.6523-24.3926 69.6514-23.2021L67.6973-17.6992Q66.1025-18.7324 64.7324-18.7324Q63.4072-18.7324 62.4863-18.0024Q61.5654-17.2725 61.0376-15.3633Q60.5098-13.4541 60.5098-7.3672M70.1455-6.8057L76.4795-7.7715Q76.8838-5.9297 78.1191-4.9751Q79.3545-4.0205 81.5781-4.0205Q84.0264-4.0205 85.2617-4.9189Q86.0928-5.5479 86.0928-6.6035Q86.0928-7.3223 85.6436-7.7939Q85.1719-8.2432 83.5322-8.6250Q75.8955-10.3096 73.8516-11.7021Q71.0215-13.6338 71.0215-17.0703Q71.0215-20.1699 73.4697-22.2812Q75.9180-24.3926 81.0615-24.3926Q85.9580-24.3926 88.3389-22.7979Q90.7197-21.2031 91.6182-18.0811L85.6660-16.9805Q85.2842-18.3730 84.2173-19.1143Q83.1504-19.8555 81.1738-19.8555Q78.6807-19.8555 77.6025-19.1592Q76.8838-18.6650 76.8838-17.8789Q76.8838-17.2051 77.5127-16.7334Q78.3662-16.1045 83.4087-14.9590Q88.4512-13.8135 90.4502-12.1514Q92.4268-10.4668 92.4268-7.4570Q92.4268-4.1777 89.6865-1.8193Q86.9463 0.5391 81.5781 0.5391Q76.7041 0.5391 73.8628-1.4375Q71.0215-3.4141 70.1455-6.8057"/><path transform="translate(300 101) scale(1.124348 1)" d="M9.6133 0L3.3018 0L3.3018-6.3115L9.6133-6.3115L9.6133 0M13.8584-6.8057L20.1924-7.7715Q20.5967-5.9297 21.8320-4.9751Q23.0674-4.0205 25.2910-4.0205Q27.7393-4.0205 28.9746-4.9189Q29.8057-5.5479 29.8057-6.6035Q29.8057-7.3223 29.3564-7.7939Q28.8848-8.2432 27.2451-8.6250Q19.6084-10.3096 17.5645-11.7021Q14.7344-13.6338 14.7344-17.0703Q14.7344-20.1699 17.1826-22.2812Q19.6309-24.3926 24.7744-24.3926Q29.6709-24.3926 32.0518-22.7979Q34.4326-21.2031 35.3311-18.0811L29.3789-16.9805Q28.9971-18.3730 27.9302-19.1143Q26.8633-19.8555 24.8867-19.8555Q22.3936-19.8555 21.3154-19.1592Q20.5967-18.6650 20.5967-17.8789Q20.5967-17.2051 21.2256-16.7334Q22.0791-16.1045 27.1216-14.9590Q32.1641-13.8135 34.1631-12.1514Q36.1396-10.4668 36.1396-7.4570Q36.1396-4.1777 33.3994-1.8193Q30.6592 0.5391 25.2910 0.5391Q20.4170 0.5391 17.5757-1.4375Q14.7344-3.4141 13.8584-6.8057M48.2910-23.8535L52.6035-23.8535L52.6035-18.8223L48.2910-18.8223L48.2910-9.2090Q48.2910-6.2891 48.4146-5.8062Q48.5381-5.3232 48.9761-5.0088Q49.4141-4.6943 50.0430-4.6943Q50.9189-4.6943 52.5811-5.3008L53.1201-0.4043Q50.9189 0.5391 48.1338 0.5391Q46.4268 0.5391 45.0566-0.0337Q43.6865-0.6064 43.0464-1.5161Q42.4063-2.4258 42.1592-3.9756Q41.9570-5.0762 41.9570-8.4229L41.9570-18.8223L39.0596-18.8223L39.0596-23.8535L41.9570-23.8535L41.9570-28.5928L48.2910-32.2764L48.2910-23.8535M63.0254-7.3672L63.0254 0L56.7139 0L56.7139-23.8535L62.5762-23.8535L62.5762-20.4619Q64.0811-22.8652 65.2827-23.6289Q66.4844-24.3926 68.0117-24.3926Q70.1680-24.3926 72.1670-23.2021L70.2129-17.6992Q68.6182-18.7324 67.2480-18.7324Q65.9229-18.7324 65.0020-18.0024Q64.0811-17.2725 63.5532-15.3633Q63.0254-13.4541 63.0254-7.3672M88.6982-7.5918L94.9873-6.5361Q93.7744-3.0771 91.1577-1.2690Q88.5410 0.5391 84.6104 0.5391Q78.3887 0.5391 75.4014-3.5264Q73.0430-6.7832 73.0430-11.7471Q73.0430-17.6768 76.1426-21.0347Q79.2422-24.3926 83.9814-24.3926Q89.3047-24.3926 92.3818-20.8774Q95.4590-17.3623 95.3242-10.1074L79.5117-10.1074Q79.5791-7.2998 81.0391-5.7388Q82.4990-4.1777 84.6777-4.1777Q86.1602-4.1777 87.1709-4.9863Q88.1816-5.7949 88.6982-7.5918M79.6240-13.9707L89.0576-13.9707Q88.9902-16.7109 87.6426-18.1372Q86.2949-19.5635 84.3633-19.5635Q82.2969-19.5635 80.9492-18.0586Q79.6016-16.5537 79.6240-13.9707M105.1846-16.5762L99.4570-17.6094Q100.4229-21.0684 102.7813-22.7305Q105.1396-24.3926 109.7891-24.3926Q114.0117-24.3926 116.0781-23.3931Q118.1445-22.3936 118.9868-20.8550Q119.8291-19.3164 119.8291-15.2061L119.7617-7.8389Q119.7617-4.6943 120.0649-3.2007Q120.3682-1.7070 121.1992 0L114.9551 0Q114.7080-0.6289 114.3486-1.8643Q114.1914-2.4258 114.1240-2.6055Q112.5068-1.0332 110.6650-0.2471Q108.8232 0.5391 106.7344 0.5391Q103.0508 0.5391 100.9282-1.4600Q98.8057-3.4590 98.8057-6.5137Q98.8057-8.5352 99.7715-10.1187Q100.7373-11.7021 102.4780-12.5444Q104.2188-13.3867 107.4980-14.0156Q111.9229-14.8467 113.6299-15.5654L113.6299-16.1943Q113.6299-18.0137 112.7314-18.7886Q111.8330-19.5635 109.3398-19.5635Q107.6553-19.5635 106.7119-18.9009Q105.7686-18.2383 105.1846-16.5762M113.6299-10.1973L113.6299-11.4551Q112.4170-11.0508 109.7891-10.4893Q107.1611-9.9277 106.3525-9.3887Q105.1172-8.5127 105.1172-7.1650Q105.1172-5.8398 106.1055-4.8740Q107.0938-3.9082 108.6211-3.9082Q110.3281-3.9082 111.8779-5.0312Q113.0234-5.8848 113.3828-7.1201Q113.6299-7.9287 113.6299-10.1973M125.5791 0L125.5791-23.8535L131.3965-23.8535L131.3965-20.5967Q134.5186-24.3926 138.8311-24.3926Q141.1221-24.3926 142.8066-23.4492Q144.4912-22.5059 145.5693-20.5967Q147.1416-22.5059 148.9609-23.4492Q150.7803-24.3926 152.8467-24.3926Q155.4746-24.3926 157.2939-23.3257Q159.1133-22.2588 160.0117-20.1924Q160.6631-18.6650 160.6631-15.2510L160.6631 0L154.3516 0L154.3516-13.6338Q154.3516-17.1826 153.7002-18.2158Q152.8242-19.5635 151.0049-19.5635Q149.6797-19.5635 148.5117-18.7549Q147.3438-17.9463 146.8271-16.3853Q146.3105-14.8242 146.3105-11.4551L146.3105 0L139.9990 0L139.9990-13.0723Q139.9990-16.5537 139.6621-17.5645Q139.3252-18.5752 138.6177-19.0693Q137.9102-19.5635 136.6973-19.5635Q135.2373-19.5635 134.0693-18.7773Q132.9014-17.9912 132.3960-16.5088Q131.8906-15.0264 131.8906-11.5898L131.8906 0"/><g transform="translate(174 73)"><g fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M0 0C-13-12-33-51-24-56C-15-61 2-23 0 0ZM0 0C-2-23 15-61 24-56C33-51 13-12 0 0Z"/><path d="M-22-49L0 0 22-49M-23 14h8M15 14h8"/></g><path fill-rule="evenodd" d="M0-1C-10-1-16 4-15 12C-14.4 17-11 19-8 20.5L-8 27.5Q-8 29-6.5 29H6.5Q8 29 8 27.5V20.5C11 19 14.4 17 15 12C16 4 10-1 0-1ZM-3 8C-3.4 5.2-7.1 4.5-10 6.4C-12.4 8.1-11.4 12.4-8.8 13.4C-6.1 14.4-2.5 11.6-3 8ZM3 8C3.4 5.2 7.1 4.5 10 6.4C12.4 8.1 11.4 12.4 8.8 13.4C6.1 14.4 2.5 11.6 3 8ZM0 14.5L-2.8 19H2.8ZM-.8 22H.8V29H-.8ZM-5.8 24H-4.4V29H-5.8ZM4.4 24H5.8V29H4.4Z"/></g></svg></span>';
  document.querySelectorAll('.brand').forEach(el=>{el.innerHTML=wordmark();});
  const home=make('a','brand-home');home.href='#tv';home.setAttribute('aria-label','Rabbit Ears home');home.innerHTML=wordmark();
  document.querySelector('h1.brand').replaceChildren(home);
  const nav=document.querySelector('.tabs');
  for(const [id,name,label] of [['tabTv','tv','TV guide'],['tabRadio','radio','Radio'],['tabGames','game','Games']]){
    const a=$(id);a.innerHTML=icon(name)+`<span class="nav-name">${label}</span>`;a.title=label;a.setAttribute('aria-label',label);
  }
  const skinButton=button('',()=>openDialog(skinDialog),'btn theme-picker');skinButton.id='chooseSkin';skinButton.innerHTML=icon('palette');skinButton.title='Choose theme';skinButton.setAttribute('aria-label','Choose theme');document.querySelector('header').append(skinButton);
  const currentSkin=make('span','current-skin');skinButton.append(currentSkin);
  function syncSkin(){currentSkin.textContent=skins.find(s=>s[0]===body.dataset.skin)[1]+(body.dataset.skin==='retro'?' · Default':'');document.querySelector('meta[name="theme-color"]').content=getComputedStyle(body).getPropertyValue('--bg').trim();}
  syncSkin();
  const pack=make('div','player-pack');const cabinet=tv.querySelector('.cabinet');
  const controls=tv.querySelector('.remote'),details=tv.querySelector('.now'),guide=tv.querySelector('.guide');
  pack.append(cabinet,controls,details);
  const hero=make('div','tv-hero');const copy=make('div','landing-copy');
  const landingStation=make('div','landing-station'),landingTitle=make('h2','landing-title');
  const eyebrow=make('p','eyebrow','ON THE AIR · SHARED BROADCAST');
  const landingNext=make('p','landing-next');
  const watch=button('Watch channel',()=>openChannel(cur),'btn watch-channel');watch.innerHTML=icon('play')+'<span>Watch channel</span>';
  copy.append(eyebrow,landingStation,landingTitle,landingNext,watch,donate());
  hero.append(copy,pack);const rail=make('aside','channel-rail');rail.setAttribute('aria-label','Tune to a channel');hero.append(rail);
  tv.prepend(hero); // same video node throughout guide, channel and fullscreen
  const guideBack=button('TV guide',showGuide,'btn guide-back');guideBack.innerHTML=icon('back')+'<span>TV guide</span>';pack.prepend(guideBack);
  const badge=make('div','playing-station');details.prepend(badge);
  const channelSchedule=make('section','channel-schedule');channelSchedule.setAttribute('aria-label','Selected channel schedule');
  const scheduleHeading=make('h3'),scheduleList=make('ol','channel-schedule-list'),scheduleStatus=make('p','schedule-status');
  channelSchedule.append(scheduleHeading,scheduleStatus,scheduleList);pack.append(channelSchedule);
  async function updateSchedule(){
    const ch=channels()[cur];if(!ch)return;const token=++scheduleToken;
    scheduleHeading.textContent=`CH ${String(ch.no).padStart(2,'0')} · ${ch.name} schedule`;
    scheduleStatus.textContent='Loading the schedule…';scheduleStatus.hidden=false;scheduleList.replaceChildren();
    try{
      const programs=await lineup(ch,nowSec(),6);if(token!==scheduleToken)return;
      if(!programs.length)throw Error('No programmes');
      for(const [i,p] of programs.entries()){
        const item=make('li','channel-schedule-item');item.dataset.start=p.start;item.dataset.channel=ch.no;
        item.append(make('span','schedule-state',i===0?'ON NOW':i===1?'UP NEXT':'LATER'));
        const time=make('time','schedule-time',`${clockFmt(p.start)}–${clockFmt(p.end)}`);time.dateTime=new Date(p.start*1000).toISOString();item.append(time);
        const title=button(p.m.title,()=>{
          if(p.start<=nowSec())openChannel(channels().findIndex(c=>c.no===ch.no));
          else{const block=make('span');block.append(make('b','',p.m.title));block.title=`${clockFmt(p.start)}–${clockFmt(p.end)}`;showFuture(ch,block);}
        },'schedule-title');title.title=i===0?'Watch the current broadcast':'Programme information';item.append(title);scheduleList.append(item);
      }
      scheduleStatus.hidden=true;
    }catch{if(token===scheduleToken)scheduleStatus.textContent='The schedule is unavailable. Please try again in a moment.';}
  }
  const hardware=make('div','tv-hardware');hardware.innerHTML='<img class="hardware-brand" src="assets/restream.svg" alt="Restream" width="240" height="112"><div class="speaker-grille" aria-hidden="true"></div><i class="power-led" aria-hidden="true"></i>';
  const tuneUp=button('Next channel',()=>openChannel(cur+1),'tuning-knob');tuneUp.title='Next channel';tuneUp.setAttribute('aria-label','Next channel');
  const tuneDown=button('Previous channel',()=>openChannel(cur-1),'tuning-knob');tuneDown.title='Previous channel';tuneDown.setAttribute('aria-label','Previous channel');
  hardware.insertBefore(tuneUp,hardware.children[1]);hardware.insertBefore(tuneDown,hardware.children[2]);cabinet.append(hardware);
  const guideNote=make('p','guide-instructions','Scroll for every channel · Select a show airing now to watch');guide.querySelector('.guide-head').after(guideNote);
  const nowMarker=make('span','guide-now-label','NOW');$('grid').prepend(nowMarker);
  guide.append(donate());details.append(donate());$('welcome').querySelector('.wcard').append(donate());
  const footerHistory=make('a','','Original design');footerHistory.href='design-history/2026-11-08-original/';footerHistory.title='Visit the preserved original interface';document.querySelector('.foot').append(footerHistory);
  function decorateGuide(){
    rows.forEach(r=>{const t=r.el.querySelector('.t');const viewer=t.querySelector('.vw'),remove=t.querySelector('.x');t.replaceChildren(station(r.ch,true));if(viewer)t.append(viewer);if(remove)t.append(remove);r.el.setAttribute('aria-label',`Channel ${r.ch.no}: ${r.ch.name}. ${r.ch.desc||''}`);});
    renderRail();
  }
  function renderRail(){rail.replaceChildren(make('h3','','Tune in'));for(const [i,ch] of channels().entries()){
    const b=button('',()=>openChannel(i),'rail-channel');b.append(station(ch,true));b.setAttribute('aria-label',`Channel ${ch.no} ${ch.name}`);b.setAttribute('aria-pressed',String(i===cur));rail.append(b);
  }}
  function channelChanged(){
    const ch=channels()[cur];if(!ch)return;
    const changed=channelNo!==ch.no;channelNo=ch.no;
    landingStation.replaceChildren(station(ch));badge.replaceChildren(station(ch,true));fullStation.replaceChildren(station(ch,true));
    rail.querySelectorAll('.rail-channel').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===cur)));
    if(changed){reveal();updateSchedule();}
  }
  function showChannel(){
    if(body.dataset.tvPage==='guide'){guideScroll=window.scrollY;guideFocus=document.activeElement?.closest('.chan');}
    const entering=body.dataset.tvPage!=='channel';body.dataset.tvPage='channel';if(entering)updateSchedule();
  }
  function openChannel(i){
    const was=mode,next=((i%channels().length)+channels().length)%channels().length;
    showChannel();if(mode!=='tv')setMode('tv');showChannel();
    if(next!==cur||(!playing&&was==='tv'))tune(next);else channelChanged();
    history.replaceState(null,'','#ch'+channels()[cur].no);
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  function showGuide(){
    if(full)exitFull();body.dataset.tvPage='guide';
    history.replaceState(null,'','#tv');if(mode!=='tv')setMode('tv');
    requestAnimationFrame(()=>{window.scrollTo(0,guideScroll);guideFocus?.focus({preventScroll:true});});
  }
  $('tabTv').addEventListener('click',e=>{e.preventDefault();showGuide();});
  home.addEventListener('click',e=>{e.preventDefault();guideScroll=0;guideFocus=null;showGuide();});
  function modeChanged(){
    body.dataset.mode=mode;if(mode!=='tv'&&full)exitFull();
    if(mode==='tv')body.dataset.tvPage=/^#ch\d+$/.test(location.hash)?'channel':'guide';
    if(mode==='tv'&&body.dataset.tvPage==='channel')updateSchedule();
  }
  function dialog(label){const d=make('dialog','interface-dialog');d.setAttribute('aria-label',label);const close=button('Close',()=>d.close(),'btn dialog-close');close.innerHTML=icon('close');close.title='Close';close.setAttribute('aria-label','Close');d.append(close);d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('close',()=>dialogOpener?.focus());body.append(d);return d;}
  function openDialog(d){dialogOpener=document.activeElement;d.showModal();}
  const skinDialog=dialog('Choose a viewing skin');skinDialog.append(make('p','eyebrow','MAKE YOURSELF AT HOME'),make('h2','','A different place to tune in'),make('p','dialog-intro','Your channel keeps playing. Your choice stays on this device.'));
  const skinGrid=make('div','skin-options');
  for(const [key,name,desc,col] of skins){const b=button('',()=>{
    body.dataset.skin=key;store.set('re_skin',key);syncSkin();skinGrid.querySelectorAll('button').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));
  },'skin-option');b.dataset.preview=key;b.style.setProperty('--sample',col);b.setAttribute('aria-pressed',String(body.dataset.skin===key));
  const mini=make('span','skin-mini');mini.setAttribute('aria-hidden','true');mini.innerHTML='<i></i><b></b>';b.append(mini,make('strong','',name+(key==='retro'?' · Default':'')),make('small','',desc));skinGrid.append(b);}
  skinDialog.append(skinGrid);
  const futureDialog=dialog('Upcoming programme');
  const futureTitle=make('h2'),futureInfo=make('p');futureDialog.append(make('p','eyebrow','COMING UP NEXT'),futureTitle,futureInfo,make('p','dialog-intro','This programme has not started. Tune in to the current broadcast or return to the guide.'),button('Watch this channel',()=>{futureDialog.close();openChannel(channels().findIndex(c=>c.no===+futureDialog.dataset.channel));}));
  function showFuture(ch,block){futureDialog.dataset.channel=ch.no;futureTitle.textContent=block.querySelector('b')?.textContent||'Upcoming programme';futureInfo.textContent=`CH ${ch.no} · ${ch.name} · ${block.title}`;openDialog(futureDialog);}
  // Fullscreen has its own temporary controls, forwarding to the existing remote actions.
  const fullControls=make('div','fullscreen-controls');
  const fullStation=make('div','fullscreen-station'),fullTitle=make('h2','fullscreen-title'),fullNext=make('p','fullscreen-next');
  const fullRemote=make('div','fullscreen-remote');
  for(const [id,label] of [['down','Previous channel'],['up','Next channel'],['back','Back 15 seconds'],['pause','Pause'],['fwd','Forward 15 seconds'],['mute','Sound'],['cc','Captions']]){
    const b=button(label,()=>{$(id).click();reveal();});b.dataset.remote=id;b.setAttribute('aria-label',label);fullRemote.append(b);
  }
  const exit=button('Exit fullscreen',exitFull);exit.innerHTML=icon('exit');exit.title='Exit fullscreen';exit.setAttribute('aria-label','Exit fullscreen');fullRemote.append(exit);
  fullControls.append(fullStation,fullTitle,fullNext,fullRemote);screen.append(fullControls);
  captionUI.syncButtons();
  function reveal(){
    clearTimeout(idleTimer);body.classList.remove('controls-idle');
    if(full)idleTimer=setTimeout(()=>{if(!fullControls.contains(document.activeElement)&&document.getElementById('caption-options').hidden)body.classList.add('controls-idle');},3000);
  }
  async function enterFull(){
    if(mode!=='tv')return;showChannel();full=true;body.classList.add('player-fullscreen');reveal();
    try{const request=screen.requestFullscreen||screen.webkitRequestFullscreen;if(request)await request.call(screen);}catch{/* in-page fullscreen remains available */}
  }
  async function exitFull(){
    full=false;clearTimeout(idleTimer);body.classList.remove('player-fullscreen','controls-idle');
    if(document.fullscreenElement||document.webkitFullscreenElement){try{await (document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch{}}
    showChannel();$('full').focus({preventScroll:true});
  }
  $('full').onclick=enterFull;
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&full)exitFull();});
  document.addEventListener('webkitfullscreenchange',()=>{if(!document.webkitFullscreenElement&&full)exitFull();});
  screen.addEventListener('pointermove',reveal);screen.addEventListener('pointerdown',e=>{if(full&&body.classList.contains('controls-idle')){e.preventDefault();reveal();}});screen.addEventListener('touchstart',reveal,{passive:true});fullControls.addEventListener('focusin',reveal);fullControls.addEventListener('focusout',()=>setTimeout(reveal));
  screen.addEventListener('captionmenuopen',reveal);
  const symbols={down:['down','Previous channel'],up:['up','Next channel'],surf:['shuffle','Random channel'],back:['rewind','Back 15 seconds'],fwd:['forward','Forward 15 seconds'],pause:['pause','Pause'],mute:['mute','Sound off'],cc:['cc','Captions'],full:['full','Fullscreen'],share:['share','Share channel'],report:['flag','Report tape'],gFull:['full','Fullscreen'],gShare:['share','Share game'],gReport:['flag','Report game']};
  function refreshSymbols(){for(const [id,[base,label]] of Object.entries(symbols)){
    const b=$(id);if(!b)continue;let name=base, accessible=b.getAttribute('aria-label')||label;
    if(id==='pause'){name=held?'play':'pause';accessible=held?'Play':'Pause';}
    if(id==='mute'){name=vid.muted?'mute':'sound';accessible='Volume';}
    if(id==='share'||id==='gShare'){if(/copied/i.test(b.textContent))accessible='Link copied';}
    const markup=icon(name)+(id==='back'||id==='fwd'?'<small>15</small>':'');
    if(!b.querySelector('svg')||b.dataset.icon!==name){b.innerHTML=markup;b.dataset.icon=name;}
    b.setAttribute('aria-label',accessible);if(id!=='cc'||!b.disabled)b.title=accessible;
  }
  for(const b of fullRemote.querySelectorAll('[data-remote]')){const original=$(b.dataset.remote);if(b.innerHTML!==original.innerHTML)b.innerHTML=original.innerHTML;b.disabled=original.disabled;b.setAttribute('aria-label',original.getAttribute('aria-label')||original.title);b.title=b.getAttribute('aria-label');if(original.hasAttribute('aria-pressed'))b.setAttribute('aria-pressed',original.getAttribute('aria-pressed'));}
  }
  function syncTitle(){landingTitle.textContent=$('title').textContent;landingNext.textContent=$('upnext').textContent||'Everyone tuned in sees the same broadcast.';fullTitle.textContent=$('title').textContent;fullNext.textContent=$('upnext').textContent;refreshSymbols();}
  new MutationObserver(syncTitle).observe(details,{subtree:true,childList:true,characterData:true});
  new MutationObserver(refreshSymbols).observe(controls,{subtree:true,childList:true,characterData:true});
  // Now-list rows are rebuilt each minute; use the same transparent, themed identities.
  new MutationObserver(()=>{for(const r of $('nowList').querySelectorAll('.nowrow')){const ch=channels().find(c=>String(c.no).padStart(2,'0')===r.querySelector('.n')?.textContent);const nm=r.querySelector('.nm');if(ch&&nm&&!nm.querySelector('.channel-identity'))nm.replaceChildren(station(ch,true));}}).observe($('nowList'),{childList:true});
  const radioSet=document.querySelector('.radio-set');
  const platter=make('div','vinyl-platter');platter.setAttribute('aria-hidden','true');platter.innerHTML='<span class="record-label">RE<br><small>33⅓ / LIVE RADIO</small></span><i class="tonearm"></i>';radioSet.prepend(platter);
  const radioAppearance=make('div','radio-appearance');radioAppearance.setAttribute('role','group');radioAppearance.setAttribute('aria-label','Radio appearance');
  for(const [look,label] of [['vinyl','Vinyl deck'],['car','Car stereo']]){const b=button(label,()=>{body.dataset.radioLook=look;store.set('re_radio_look',look);radioAppearance.querySelectorAll('button').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));});b.setAttribute('aria-pressed',String(body.dataset.radioLook===look));radioAppearance.append(b);}
  $('radioView').prepend(radioAppearance);
  const stereoBadge=make('span','stereo-badge','RE AUDIO / FM STEREO');radioSet.append(stereoBadge);
  audio.addEventListener('playing',()=>body.classList.add('radio-playing'));audio.addEventListener('pause',()=>body.classList.remove('radio-playing'));
  document.addEventListener('keydown',e=>{
    if(e.target.closest('#caption-options'))return;
    if(document.querySelector('dialog[open]')||document.querySelector('[popover]:popover-open')||!$('welcome').hidden)return;
    if(e.key==='Escape'&&mode==='tv'){if(full){e.preventDefault();e.stopImmediatePropagation();exitFull();}else if(body.dataset.tvPage==='channel'){e.preventDefault();e.stopImmediatePropagation();showGuide();}return;}
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    if(full)reveal();
    if(mode==='tv'&&body.dataset.tvPage==='guide'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();e.stopImmediatePropagation();const i=rows.findIndex(r=>r.el===document.activeElement);if(e.key==='ArrowUp'||e.key==='ArrowDown'){rows[Math.max(0,Math.min(rows.length-1,(i<0?cur:i)+(e.key==='ArrowDown'?1:-1)))]?.el.focus();}else $('grid').scrollBy({left:e.key==='ArrowRight'?240:-240,behavior:'smooth'});
    }
  },true);
  window.REUI={openChannel,showChannel,showGuide,showFuture,decorateGuide,channelChanged,modeChanged};
  setInterval(()=>{if(mode==='tv'&&body.dataset.tvPage==='channel')updateSchedule();},60000);
  fetch('assets/channel-logos/manifest.json?v=transparent-2').then(r=>{if(!r.ok)throw Error('Channel logos unavailable');return r.json();}).then(data=>{logos=data;decorateGuide();channelChanged();}).catch(()=>{renderRail();channelChanged();});
  decorateGuide();channelChanged();syncTitle();modeChanged();
})();
