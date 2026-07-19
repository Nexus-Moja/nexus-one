import React, {useEffect, useId, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {motion, AnimatePresence, useReducedMotion} from 'framer-motion';
import {Ambulance, Accessibility, ArrowRight, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, FileCheck2, Globe2, Info, Mail, MapPin, Menu, Pause, Phone, Play, Route, ShieldCheck, Users, Van, X} from 'lucide-react';
import './styles.css';

const services=[
 {icon:Accessibility,title:'Wheelchair Transportation',tag:'Accessible',copy:'Private, door-through-door transportation with securement support and patient-centered assistance.',accent:'blue'},
 {icon:Van,title:'Stretcher & Bariatric',tag:'Specialized',copy:'Non-emergency stretcher and bariatric-capable transportation coordinated around patient needs.',accent:'teal'},
 {icon:Ambulance,title:'Ambulance Services',tag:'Medical',copy:'Professional scheduled ambulance transportation and inter-facility coordination.',accent:'red'},
 {icon:CalendarDays,title:'Dialysis & Recurring Trips',tag:'Reliable',copy:'Standing-order scheduling designed to support continuity of care and reduce missed appointments.',accent:'purple'},
 {icon:Building2,title:'Hospital Discharge',tag:'Coordinated',copy:'Clear coordination among discharge teams, families, destinations and Nexus operations.',accent:'orange'},
 {icon:Route,title:'Medical Shuttle',tag:'Community',copy:'Accessible group and facility shuttle options for healthcare and senior programs.',accent:'green'}
];

const navItems=[
 {label:'Services',href:'#services'},
 {label:'Experience',href:'#patient-experience'},
 {label:'Coverage',href:'#coverage'},
 {label:'Facilities',href:'#facilities'},
 {label:'Assurance',href:'#safety-and-quality'}
];
const languageOptions=[
 ['en-US','🇺🇸','English'],['en-GB','🇬🇧','English UK'],['fr','🇫🇷','Français'],['es','🇪🇸','Español']
];
function LanguageSelector(){
 const [locale,setLocale]=useState(()=>localStorage.getItem('nexus_locale')||'en-US');
 useEffect(()=>{const sync=e=>setLocale(e.detail?.locale||document.documentElement.dataset.locale||'en-US');window.addEventListener('nexus:localechange',sync);return()=>window.removeEventListener('nexus:localechange',sync)},[]);
 const change=e=>{const next=e.target.value;setLocale(next);window.NexusI18n?.setLocale(next)};
 return <label className="headerLanguage"><Globe2 size={17} aria-hidden="true"/><span className="srOnly">Select language</span><select data-nexus-language="" aria-label="Select language" value={locale} onChange={change}>{languageOptions.map(([code,flag,label])=><option key={code} value={code}>{flag} {label}</option>)}</select></label>
}

const portalCards=[
 {icon:CalendarDays,title:'Schedule & manage rides',copy:'Submit one-time or recurring requests through one centralized workflow.'},
 {icon:MapPin,title:'Track status and ETA',copy:'See request status, driver assignment and arrival updates.'},
 {icon:FileCheck2,title:'Invoices & reports',copy:'Access ride history, downloadable invoices and service reporting.'},
 {icon:Users,title:'Facility user controls',copy:'Manage schedulers, roles and location-level access.'}
];

const heroSlides=[
 {image:'./assets/nexus-coverage-livecare.png',alt:'Nexus Medical Transit coverage area across Maryland, Washington DC and Northern Virginia',eyebrow:'Livecare',title:'Know what is happening with every ride.',copy:'Track transportation progress, follow status milestones and stay connected with Nexus throughout the journey.',service:''},
 {image:'./assets/nexus-shuttle-side.webp',alt:'Side view of a Nexus Medical Transit accessible shuttle vehicle',eyebrow:'Accessible shuttle service',title:'A visible commitment to safe, accessible transportation.',copy:'Wheelchair-accessible shuttle service with clear identification, secure boarding and compassionate care.',service:'Medical Shuttle'},
 {image:'./assets/nexus-ambulance-exterior.webp',alt:'Nexus Medical Transit ambulance parked outdoors',eyebrow:'Ambulance transportation',title:'Professional medical transport when coordination matters.',copy:'Scheduled ambulance and inter-facility transportation supported by trained professionals and clear communication.',service:'Ambulance Services'},
 {image:'./assets/nexus-accessible-bus-side.webp',alt:'Side view of a Nexus Medical Transit wheelchair and shuttle vehicle',eyebrow:'Accessible mobility',title:'Wheelchair transportation centered on dignity and comfort.',copy:'Door-through-door support, securement assistance and private accessible service throughout the Washington Metropolitan Area.',service:'Wheelchair Transportation'},
 {image:'./assets/nexus-ambulance-interior.webp',alt:'Interior of an equipped medical transport ambulance with stretcher',eyebrow:'Prepared for patient care',title:'A clean, secure environment for every medical journey.',copy:'Professional equipment, securement systems and a patient-ready interior designed around safety and comfort.',service:'Stretcher & Bariatric'},
 {image:'./assets/nexus-shuttle-rear.webp',alt:'Rear view of a branded Nexus Medical Transit accessible shuttle',eyebrow:'Easy to identify',title:'Patients and facilities can recognize the Nexus vehicle with confidence.',copy:'Highly visible branding, accessible markings and direct contact information support a safer pickup experience.',service:'Wheelchair Transportation'}
];

function BookRideButton({onBook,service='',className='primary',children='Book a Ride'}){
 return <button type="button" className={`${className} bookRideCta`} onClick={()=>onBook(service)} data-book-ride="true">{children}</button>
}

function HeroCarousel({onBook}){
 const [index,setIndex]=useState(0);
 const [userPaused,setUserPaused]=useState(false);
 const [interactionPaused,setInteractionPaused]=useState(false);
 const [direction,setDirection]=useState(1);
 const prefersReducedMotion=useReducedMotion();
 const slide=heroSlides[index];
 const paused=userPaused||interactionPaused||prefersReducedMotion;
 useEffect(()=>{
  if(paused)return;
  const timer=setInterval(()=>{setDirection(1);setIndex(i=>(i+1)%heroSlides.length)},5200);
  return()=>clearInterval(timer);
 },[paused]);
 const go=(next)=>{setDirection(next>index?1:-1);setIndex((next+heroSlides.length)%heroSlides.length)};
 const handleKeys=(event)=>{
  if(event.key==='ArrowLeft'){event.preventDefault();go(index-1)}
  if(event.key==='ArrowRight'){event.preventDefault();go(index+1)}
 };
 return <div className="heroCarousel" role="region" aria-roledescription="carousel" aria-label="Featured Nexus transportation services" onKeyDown={handleKeys} onMouseEnter={()=>setInteractionPaused(true)} onMouseLeave={()=>setInteractionPaused(false)} onFocusCapture={()=>setInteractionPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setInteractionPaused(false)}}>
  <p className="srOnly" aria-live="polite">Slide {index+1} of {heroSlides.length}: {slide.title}</p>
  <div className="carouselTop"><div><small>Nexus Medical Transit</small><strong>Care in motion</strong></div><span className="available"><i aria-hidden="true"/>Requests open</span></div>
  <div className="carouselViewport">
   <AnimatePresence initial={false} custom={direction} mode="wait">
    <motion.article key={slide.image} role="group" aria-roledescription="slide" aria-label={`${index+1} of ${heroSlides.length}: ${slide.title}`} custom={direction} variants={{enter:d=>prefersReducedMotion?{opacity:0}:{x:d>0?'11%':'-11%',opacity:0,scale:1.025},center:{x:0,opacity:1,scale:1},exit:d=>prefersReducedMotion?{opacity:0}:{x:d>0?'-8%':'8%',opacity:0,scale:.99}}} initial="enter" animate="center" exit="exit" transition={{duration:prefersReducedMotion?0:.55,ease:[.22,1,.36,1]}} className="heroSlide">
     <img src={slide.image} alt={slide.alt} loading={index===0?'eager':'lazy'} />
     <div className="slideShade" aria-hidden="true"/>
     <div className="slideContent"><span>{slide.eyebrow}</span><h3>{slide.title}</h3><p>{slide.copy}</p><BookRideButton onBook={onBook} service={slide.service} className="slideBookRide">Book a Ride <ArrowRight size={17} aria-hidden="true"/></BookRideButton></div>
    </motion.article>
   </AnimatePresence>
  </div>
  <div className="carouselControls" aria-label="Carousel controls">
   <button type="button" className="roundControl" onClick={()=>go(index-1)} aria-label="Previous slide"><ChevronLeft aria-hidden="true"/></button>
   <div className="carouselDots" role="group" aria-label="Choose a slide">{heroSlides.map((item,i)=><button type="button" key={item.title} className={i===index?'active':''} onClick={()=>go(i)} aria-label={`Show slide ${i+1}: ${item.title}`} aria-current={i===index?'true':undefined}><span aria-hidden="true"/></button>)}</div>
   <button type="button" className="roundControl" onClick={()=>go(index+1)} aria-label="Next slide"><ChevronRight aria-hidden="true"/></button>
   <button type="button" className="pauseControl" onClick={()=>setUserPaused(v=>!v)} aria-pressed={userPaused} aria-label={userPaused?'Resume automatic slide rotation':'Pause automatic slide rotation'}>{userPaused?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}<span>{userPaused?'Play':'Pause'}</span></button>
  </div>
 </div>
}
const journey=[['01','Request','Select service, pickup, destination, timing and mobility needs.'],['02','Coordinate','Nexus reviews availability, vehicle requirements and care instructions.'],['03','Stay informed','Patient, family and facility receive clear ride-status updates.'],['04','Arrive safely','Door-through-door support and trip completion confirmation.']];

function App(){
 const [mobile,setMobile]=useState(false); const [booking,setBooking]=useState(false); const [partner,setPartner]=useState(false); const [service,setService]=useState('');
 const [info,setInfo]=useState(null); const [accessOpen,setAccessOpen]=useState(false); const [track,setTrack]=useState(false);
 const [largeText,setLargeText]=useState(false); const [highContrast,setHighContrast]=useState(false); const [reduceMotion,setReduceMotion]=useState(false);
 const openBooking=(s='')=>{setService(s);setBooking(true)};
 const openInfo=(title,copy,action)=>setInfo({title,copy,action});
 useEffect(()=>{document.body.classList.toggle('largeText',largeText);document.body.classList.toggle('highContrast',highContrast);document.body.classList.toggle('reduceMotion',reduceMotion)},[largeText,highContrast,reduceMotion]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('book')==='1'){openBooking(params.get('service')||'');window.history.replaceState({},'',window.location.pathname+window.location.hash)}},[]);
 return <div>
  <a className="skipLink" href="#main-content">Skip to main content</a>
  <header className="topbar"><div className="shell nav">
   <a className="brand" href="#home" aria-label="Nexus Medical Transit home"><img className="nexusLogo" src="./nexus-logo.png" alt="Nexus Medical Transit" /></a>
   <nav id="primary-navigation" aria-label="Primary navigation" className={mobile?'navlinks open':'navlinks'}>{navItems.map(item=><a key={item.label} href={item.href} onClick={()=>setMobile(false)}>{item.label}</a>)}</nav>
   <div className="navRight"><a className="livecareLink" href="/livecare.html">Livecare</a><LanguageSelector/><a className="call" href="tel:+18887604990" aria-label="Call Nexus at 888-760-4990"><Phone size={18} aria-hidden="true"/><span><small>Call Nexus</small><b>(888) 760-4990</b></span></a><BookRideButton onBook={openBooking} className="navBookRide"><span>Book a Ride</span><ArrowRight size={18} aria-hidden="true"/></BookRideButton><button type="button" className="menuBtn" aria-label={mobile?'Close navigation menu':'Open navigation menu'} aria-expanded={mobile} aria-controls="primary-navigation" onClick={()=>setMobile(!mobile)}>{mobile?<X aria-hidden="true"/>:<Menu aria-hidden="true"/>}</button></div>
  </div></header>

  <main id="main-content" tabIndex="-1">
   <section id="home" className="hero"><div className="heroGlow one"/><div className="heroGlow two"/><div className="shell heroGrid">
    <motion.div initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.65}} className="heroCopy">
     <div className="eyebrow"><span/> Washington Metropolitan Healthcare Mobility</div>
     <h1>Every medical journey deserves <em>care, clarity and dignity.</em></h1>
     <p>Nexus Medical Transit delivers accessible wheelchair, stretcher, shuttle and ambulance transportation throughout Maryland, Washington, DC and Northern Virginia.</p>
     <div className="heroActions"><BookRideButton onBook={openBooking} className="primary xl">Book a Ride <ArrowRight size={18} aria-hidden="true"/></BookRideButton><button className="secondary xl" onClick={()=>setPartner(true)}>Facility Solutions</button></div>
     <div className="proof"><span><CheckCircle2/>Door-through-door support</span><span><CheckCircle2/>Multilingual assistance</span><span><CheckCircle2/>Accessible fleet options</span></div>
    </motion.div>
    <motion.div initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} transition={{delay:.15,duration:.7}} className="heroProduct heroCarouselShell">
      <HeroCarousel onBook={openBooking} />
    </motion.div>
   </div>
   <div className="shell serviceStrip">{[{i:Accessibility,t:'Wheelchair',s:'Private accessible transport',service:'Wheelchair Transportation'},{i:Van,t:'Stretcher',s:'Non-emergency support',service:'Stretcher & Bariatric'},{i:Ambulance,t:'Ambulance',s:'Medical transport',service:'Ambulance Services'},{i:Route,t:'Shuttle',s:'Facility mobility',service:'Medical Shuttle'}].map(({i:I,t,s,service})=><button type="button" key={t} onClick={()=>openBooking(service)} aria-label={`Request ${t} transportation`}><span><I/></span><p><b>{t}</b><small>{s}</small></p><ChevronRight size={17}/></button>)}</div>
   </section>

   <section id="services" className="section"><div className="shell"><Header kicker="Complete mobility support" title="The right level of care for every journey." copy="Clear service pathways for patients, families, discharge planners and healthcare teams."/><div className="services">{services.map(({icon:I,title,tag,copy,accent})=><motion.article whileHover={{y:-7}} key={title} className={'service '+accent}><div className="serviceHead"><span><I/></span><small>{tag}</small></div><h3>{title}</h3><p>{copy}</p><BookRideButton onBook={openBooking} service={title} className="serviceBookRide">Book a Ride <ChevronRight size={17} aria-hidden="true"/></BookRideButton></motion.article>)}</div></div></section>

   <section id="patient-experience" className="section muted"><div className="shell split"><div><div className="eyebrow dark"><span/> A better patient journey</div><h2>Confidence before, during and after the ride.</h2><p className="lead">The new Nexus experience combines compassionate care with practical technology—without replacing the human support patients rely on.</p><div className="journey">{journey.map(([n,t,c])=><article key={n}><b>{n}</b><div><h3>{t}</h3><p>{c}</p></div></article>)}</div></div><div className="phoneMock"><div className="phoneTop"><span/><b>Nexus Trip Status</b><button type="button" aria-label="View trip status details" onClick={()=>openInfo('Trip-status experience','Patients and authorized caregivers can view request receipt, coordination review, driver assignment, ETA updates and safe-arrival confirmation.','Book a transportation request')}>•••</button></div><div className="phoneMap"><div className="street one"/><div className="street two"/><div className="street three"/><span className="mapStart"/><span className="mapEnd"/><span className="mapVan"><Ambulance/></span></div><div className="nextUpdate"><div><small>Next update</small><b>Driver assignment pending</b></div><span>Coordinating</span></div><div className="phoneTimeline">{['Request received','Coordination review','Driver assigned','Safe arrival'].map((x,i)=><div className={i===0?'done':i===1?'active':''} key={x}><b>{i===0?'✓':i+1}</b><span><strong>{x}</strong><small>{['Transportation details submitted','Matching service and availability','Vehicle and arrival window shared','Trip completion confirmed'][i]}</small></span></div>)}</div></div></div></section>

   <section id="coverage" className="section darkSection"><div className="shell coverageGrid"><div className="regionalMap"><div className="mapLabel md">MARYLAND</div><div className="mapLabel dc">DC</div><div className="mapLabel va">VIRGINIA</div><svg viewBox="0 0 620 500" aria-hidden="true" focusable="false"><path d="M70 390 C180 330 230 210 335 270 S470 375 560 115"/><path d="M115 170 C235 250 345 205 520 325"/></svg><span className="dot d1"/><span className="dot d2"/><span className="dot d3"/><span className="dot d4"/></div><div><div className="eyebrow"><span/> Regional coverage</div><h2>Local coordination across the capital region.</h2><p className="lead lightText">Transportation throughout Maryland, Washington, DC and Northern Virginia, subject to trip needs and availability.</p><div className="coverageList"><article><b>Maryland</b><span>Montgomery, Prince George’s, Frederick, Howard, Anne Arundel and surrounding communities.</span></article><article><b>Washington, DC</b><span>Hospital discharge, dialysis, rehabilitation and specialty appointments.</span></article><article><b>Northern Virginia</b><span>Arlington, Alexandria, Fairfax and surrounding communities.</span></article></div><button className="lightButton" onClick={()=>openBooking()}>Check a trip location</button></div></div></section>

   <section id="facilities" className="section"><div className="shell split"><div><div className="eyebrow dark"><span/> Facility partnership portal</div><h2>Built for case managers, schedulers and care teams.</h2><p className="lead">We are reusing the Nexus facility workflows already designed: centralized ride requests, recurring scheduling, ETA visibility, billing documents and role-based access.</p><div className="portalGrid">{portalCards.map(({icon:I,title,copy})=><button type="button" key={title} onClick={()=>openInfo(title,copy,'Open facility partnership request')}><I/><h3>{title}</h3><p>{copy}</p><span>Explore feature <ChevronRight size={16}/></span></button>)}</div><div className="heroActions"><button className="primary xl" onClick={()=>setPartner(true)}>Become a Facility Partner</button><a className="outline xl" href="tel:+18887604990">Speak with Nexus</a></div></div><FacilityPreview onAction={(title,copy)=>openInfo(title,copy,'Open facility partnership request')}/></div></section>

   <section id="safety-and-quality" className="section muted"><div className="shell qualityGrid"><div><div className="eyebrow dark"><span/> Safety, quality and compliance</div><h2>Operational accountability made visible.</h2><p className="lead">The platform will bring together the QA transparency work, complaint process, mechanical-failure reporting, policies, employee acknowledgments and compliance documentation already created for Nexus.</p></div><div className="qualityCards"><button type="button" onClick={()=>openInfo('Quality & complaint center','Submit feedback or complaints, track internal review, and support measurable quality improvement.','Contact Nexus quality team')}><ShieldCheck/><div><h3>Quality & complaint center</h3><p>Clear public and internal pathways for feedback, review and continuous improvement.</p></div><ChevronRight/></button><button type="button" onClick={()=>openInfo('Compliance document library','Centralized policies, acknowledgments, training records and audit-ready documentation for authorized users.','Request compliance information')}><FileCheck2/><div><h3>Compliance document library</h3><p>Centralized policies, acknowledgments, training records and audit-ready documentation.</p></div><ChevronRight/></button><button type="button" onClick={()=>openInfo('Mechanical failure workflow','Drivers report vehicle issues, fleet leaders receive alerts, and unsafe vehicles can be taken out of service until cleared.','Speak with Nexus operations')}><Van/><div><h3>Mechanical failure workflow</h3><p>Driver reporting, vehicle status, fleet notifications and corrective action tracking.</p></div><ChevronRight/></button></div></div></section>

   <section className="cta"><div className="shell ctaInner"><div><div className="eyebrow"><span/> Access Drives Equity</div><h2>Let’s coordinate the next medical journey.</h2><p>Request a ride online or speak directly with the Nexus team.</p></div><div className="heroActions"><BookRideButton onBook={openBooking} className="white xl">Book a Ride</BookRideButton><a className="ghost xl" href="tel:+18887604990">Call (888) 760-4990</a></div></div></section>
  </main>

  <footer><div className="shell footerGrid"><div className="footerBrand"><a className="brand footerLogoLink" href="#home" aria-label="Nexus Medical Transit home"><img className="nexusLogo footerNexusLogo" src="./nexus-footer-logo.png" alt="Nexus Medical Transit" /></a><p>Compassionate, timely and inclusive healthcare mobility across the Washington Metropolitan Area.</p></div><div><h4>Patients & Families</h4><button onClick={()=>openBooking()}>Book Transportation</button><button onClick={()=>setTrack(true)}>Track a Request</button><a href="#services">Services</a><a href="#safety-and-quality">Assurance</a></div><div><h4>Healthcare Partners</h4><button onClick={()=>setPartner(true)}>Facility Partnership</button><a href="#coverage">Coverage</a><a href="/facility.html">Facility Portal</a></div><div><h4>Contact</h4><a href="tel:+18887604990">(888) 760-4990</a><a href="mailto:contact@nexusmt.com">contact@nexusmt.com</a><a href="https://wa.me/12023159253" target="_blank" rel="noopener noreferrer">WhatsApp: (202) 315-9253 <span className="srOnly">(opens in a new tab)</span></a><span>Dispatch: 24/7</span><span>Office: Mon–Fri, 8 AM–6 PM ET</span><a href="https://nexusmt.com" target="_blank" rel="noopener noreferrer">nexusmt.com <span className="srOnly">(opens in a new tab)</span></a><a href="./accessibility.html">Accessibility statement</a></div></div><div className="shell footerBottom"><span>© 2026 Nexus Medical Transit LLC</span><span>For emergencies, call 911.</span></div></footer>

  <button className="accessButton" type="button" aria-expanded={accessOpen} aria-controls="accessibility-options" aria-label={accessOpen?'Close Section 508 accessibility options':'Open Section 508 accessibility options'} onClick={()=>setAccessOpen(v=>!v)}><Accessibility aria-hidden="true"/><span className="access508" aria-hidden="true">508</span></button>
  {accessOpen&&<div id="accessibility-options" className="accessPanel" role="region" aria-label="Accessibility display options"><strong>Accessibility</strong><button type="button" aria-pressed={largeText} onClick={()=>setLargeText(v=>!v)}>Larger text</button><button type="button" aria-pressed={highContrast} onClick={()=>setHighContrast(v=>!v)}>High contrast</button><button type="button" aria-pressed={reduceMotion} onClick={()=>setReduceMotion(v=>!v)}>Reduce motion</button></div>}

  <AnimatePresence>{booking&&<Modal title="Book a Ride" subtitle="Submit a transportation request securely. Nexus will review availability and contact you to confirm." close={()=>setBooking(false)}><BookingForm initial={service}/></Modal>}{partner&&<Modal title="Facility Partnership" subtitle="Tell Nexus about your organization and transportation coordination needs." close={()=>setPartner(false)}><PartnerForm/></Modal>}{track&&<Modal title="Track a Request" subtitle="Enter the confirmation reference and phone number used when the request was submitted." close={()=>setTrack(false)}><TrackForm/></Modal>}{info&&<Modal title={info.title} subtitle={info.copy} close={()=>setInfo(null)}><div className="infoActions"><button className="primary xl" onClick={()=>{setInfo(null);info.action?.toLowerCase().includes('facility')?setPartner(true):openBooking()}}>{info.action?.toLowerCase().includes('facility')?'Open Facility Request':'Book a Ride'} <ArrowRight size={18} aria-hidden="true"/></button><a className="outline xl" href="tel:+18887604990"><Phone size={17}/> Call Nexus</a></div></Modal>}</AnimatePresence>
 </div>
}

function Header({kicker,title,copy}){return <div className="sectionHeader"><div><div className="eyebrow dark"><span/> {kicker}</div><h2>{title}</h2></div><p>{copy}</p></div>}
function FacilityPreview({onAction}){return <div className="facilityPreview"><div className="previewTop"><div><small>Facility workspace</small><strong>Ride management</strong></div><span><i aria-hidden="true"/>Portal preview</span></div><div className="previewStats"><button type="button" onClick={()=>onAction('Facility scheduling','Submit one-time, recurring and standing-order requests through one coordinated workflow.')}><small>Scheduling</small><b>One-time & recurring</b></button><button type="button" onClick={()=>onAction('Trip visibility','View request status, driver assignment and estimated arrival updates.')}><small>Visibility</small><b>Status & ETA</b></button><button type="button" onClick={()=>onAction('Facility documents','Access ride history, invoices and service reports for authorized facility users.')}><small>Documents</small><b>Invoices & reports</b></button></div><div className="previewTable"><table><caption>Example facility ride requests</caption><thead><tr><th scope="col">Journey</th><th scope="col">Service</th><th scope="col">Status</th></tr></thead><tbody><tr><td>Hospital to residence</td><td>Wheelchair</td><td><span className="status amber">Reviewing</span></td></tr><tr><td>Recurring dialysis</td><td>Ambulatory</td><td><span className="status green">Confirmed</span></td></tr><tr><td>Inter-facility</td><td>Stretcher</td><td><span className="status blue">Coordinating</span></td></tr></tbody></table></div></div>}
function Modal({title,subtitle,close,children}){
 const dialogRef=useRef(null); const titleId=useId(); const descriptionId=useId(); const previousFocus=useRef(null);
 useEffect(()=>{
  previousFocus.current=document.activeElement;
  const dialog=dialogRef.current;
  const focusables=()=>Array.from(dialog?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')||[]);
  const first=focusables()[0]; first?.focus();
  const h=e=>{
   if(e.key==='Escape'){e.preventDefault();close();return}
   if(e.key==='Tab'){
    const items=focusables(); if(!items.length)return;
    const firstItem=items[0],lastItem=items[items.length-1];
    if(e.shiftKey&&document.activeElement===firstItem){e.preventDefault();lastItem.focus()}
    else if(!e.shiftKey&&document.activeElement===lastItem){e.preventDefault();firstItem.focus()}
   }
  };
  document.addEventListener('keydown',h); document.body.style.overflow='hidden';
  return()=>{document.removeEventListener('keydown',h);document.body.style.overflow='';previousFocus.current?.focus?.()}
 },[close]);
 return <motion.div className="modalBackdrop" role="presentation" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><motion.div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} initial={{y:25,opacity:0,scale:.98}} animate={{y:0,opacity:1,scale:1}} exit={{y:15,opacity:0}}><button type="button" className="close" aria-label="Close dialog" onClick={close}><X aria-hidden="true"/></button><div className="eyebrow dark"><span aria-hidden="true"/> Nexus Care Coordination</div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{subtitle}</p>{children}</motion.div></motion.div>
}
const GOOGLE_MAPS_API_KEY=import.meta.env.VITE_GOOGLE_MAPS_API_KEY||'';
let googleMapsPromise;
function loadGoogleMaps(){
 if(window.google?.maps)return Promise.resolve(window.google.maps);
 if(!GOOGLE_MAPS_API_KEY)return Promise.reject(new Error('Google Maps is not configured.'));
 if(googleMapsPromise)return googleMapsPromise;
 googleMapsPromise=new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-nexus-google-maps="true"]');
  if(existing){existing.addEventListener('load',()=>resolve(window.google.maps),{once:true});existing.addEventListener('error',()=>reject(new Error('Google Maps could not be loaded.')),{once:true});return}
  const callback=`nexusMapsReady_${Date.now()}`;
  window[callback]=()=>{delete window[callback];resolve(window.google.maps)};
  const script=document.createElement('script');
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places&loading=async&callback=${callback}`;
  script.async=true;script.defer=true;script.dataset.nexusGoogleMaps='true';
  script.onerror=()=>reject(new Error('Google Maps could not be loaded.'));
  document.head.appendChild(script);
 });
 return googleMapsPromise;
}
const STRIPE_PAYMENT_URL='https://buy.stripe.com/5kQbJ3fa5d';
const PAYPAL_PAYMENT_URL='https://www.paypal.com/ncp/payment/PBVF5DPELEWH8';
const PAYPAL_CLIENT_ID='BAAcWF0L_8FefwaVhIZPJ8c_R_fwbtXqOAEmCk3W9D7q5QfNKlc9yw-OYcIQhysPNwiOXW0Pja8AdTEcYE';
const PAYPAL_HOSTED_BUTTON_ID='X5LEDQNNSJLD8';

let paypalSdkPromise;
function loadPayPalSdk(){
 if(window.paypal?.HostedButtons)return Promise.resolve(window.paypal);
 if(paypalSdkPromise)return paypalSdkPromise;
 paypalSdkPromise=new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-nexus-paypal="true"]');
  if(existing){existing.addEventListener('load',()=>resolve(window.paypal),{once:true});existing.addEventListener('error',()=>reject(new Error('PayPal could not be loaded.')),{once:true});return}
  const script=document.createElement('script');
  script.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&components=hosted-buttons&enable-funding=venmo&currency=USD`;
  script.async=true;script.dataset.nexusPaypal='true';
  script.onload=()=>resolve(window.paypal);script.onerror=()=>reject(new Error('PayPal could not be loaded.'));
  document.head.appendChild(script);
 });
 return paypalSdkPromise;
}
function PaymentOptions({reference,fare}){
 const paypalRef=useRef(null); const [paypalError,setPaypalError]=useState('');
 useEffect(()=>{
  let active=true;
  loadPayPalSdk().then(paypal=>{
   if(!active||!paypalRef.current||!paypal?.HostedButtons)return;
   paypalRef.current.innerHTML='';
   paypal.HostedButtons({hostedButtonId:PAYPAL_HOSTED_BUTTON_ID}).render(paypalRef.current).catch(()=>setPaypalError('Use the PayPal secure checkout link below.'));
  }).catch(()=>{if(active)setPaypalError('Use the PayPal secure checkout link below.')});
  return()=>{active=false};
 },[]);
 return <section className="paymentPanel" aria-labelledby="payment-heading">
  <div className="paymentHeader"><div><span className="paymentEyebrow">Secure payment</span><h4 id="payment-heading">Choose how to pay for this trip</h4></div>{fare&&<strong className="paymentAmount">Estimated ${Number(fare).toFixed(2)}</strong>}</div>
  <p>Use your Nexus confirmation <b>{reference}</b> when completing checkout. The final trip charge remains subject to dispatch confirmation.</p>
  <div className="paymentGrid">
   <a className="paymentMethod stripePay" href={STRIPE_PAYMENT_URL} target="_blank" rel="noopener noreferrer"><span><b>Card, Apple Pay or Google Pay</b><small>Secure checkout powered by Stripe</small></span><ExternalLink size={18} aria-hidden="true"/></a>
   <div className="paypalPay"><div ref={paypalRef} aria-label="PayPal and Venmo secure payment button"/><a href={PAYPAL_PAYMENT_URL} target="_blank" rel="noopener noreferrer">Open PayPal or Venmo checkout <ExternalLink size={16} aria-hidden="true"/></a>{paypalError&&<small role="status">{paypalError}</small>}</div>
  </div>
  <div className="paymentTrust"><ShieldCheck size={18} aria-hidden="true"/><span>Payments are processed by Stripe or PayPal. Nexus does not store card details in this application.</span></div>
 </section>
}

const fareRules={
 'Wheelchair Transportation':{base:55,perMile:3.25},
 'Stretcher & Bariatric':{base:145,perMile:6.5},
 'Ambulance Services':{base:250,perMile:9.5},
 'Dialysis & Recurring Trips':{base:48,perMile:2.95},
 'Hospital Discharge':{base:72,perMile:3.75},
 'Medical Shuttle':{base:45,perMile:2.5}
};
function estimateFare(service,miles){
 const rule=fareRules[service];
 if(!rule||!Number.isFinite(miles))return null;
 return Math.round((rule.base+rule.perMile*miles)*100)/100;
}
function BookingForm({initial}){
 const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const [summary,setSummary]=useState(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [copyMessage,setCopyMessage]=useState('');
 const [service,setService]=useState(initial||''); const [route,setRoute]=useState(null); const [mapError,setMapError]=useState(''); const [mapsReady,setMapsReady]=useState(false);
 const pickupRef=useRef(null); const destinationRef=useRef(null); const mapRef=useRef(null); const directionsRendererRef=useRef(null); const pickupPlaceRef=useRef(null); const destinationPlaceRef=useRef(null);
 useEffect(()=>{
  let active=true;
  loadGoogleMaps().then(async()=>{
   if(!active)return;
   setMapsReady(true);
   const pickupAutocomplete=new window.google.maps.places.Autocomplete(pickupRef.current,{fields:['formatted_address','geometry','name'],componentRestrictions:{country:'us'}});
   const destinationAutocomplete=new window.google.maps.places.Autocomplete(destinationRef.current,{fields:['formatted_address','geometry','name'],componentRestrictions:{country:'us'}});
   pickupAutocomplete.addListener('place_changed',()=>{pickupPlaceRef.current=pickupAutocomplete.getPlace();calculateRoute()});
   destinationAutocomplete.addListener('place_changed',()=>{destinationPlaceRef.current=destinationAutocomplete.getPlace();calculateRoute()});
  }).catch(err=>{if(active)setMapError(err.message)});
  return()=>{active=false};
 },[]);
 const calculateRoute=async()=>{
  const origin=pickupPlaceRef.current?.geometry?.location||pickupRef.current?.value;
  const destination=destinationPlaceRef.current?.geometry?.location||destinationRef.current?.value;
  if(!origin||!destination||!window.google?.maps)return;
  try{
   setMapError('');
   if(!mapRef.current)return;
   const map=new window.google.maps.Map(mapRef.current,{center:{lat:39.0839,lng:-77.1528},zoom:9,mapTypeControl:false,streetViewControl:false,fullscreenControl:false});
   const serviceObj=new window.google.maps.DirectionsService();
   const renderer=new window.google.maps.DirectionsRenderer({map,preserveViewport:false,polylineOptions:{strokeWeight:6}});
   directionsRendererRef.current=renderer;
   const result=await serviceObj.route({origin,destination,travelMode:window.google.maps.TravelMode.DRIVING,drivingOptions:{departureTime:new Date(),trafficModel:'bestguess'}});
   renderer.setDirections(result);
   const leg=result.routes?.[0]?.legs?.[0];
   if(!leg)throw new Error('A driving route could not be calculated.');
   const miles=leg.distance.value/1609.344;
   setRoute({miles,displayMiles:`${miles.toFixed(1)} miles`,duration:leg.duration_in_traffic?.text||leg.duration?.text||'Unavailable',pickup:leg.start_address,destination:leg.end_address});
   if(pickupRef.current)pickupRef.current.value=leg.start_address;
   if(destinationRef.current)destinationRef.current.value=leg.end_address;
  }catch(err){setRoute(null);setMapError('We could not calculate this route. Confirm both addresses and try again.')}
 };
 const fare=estimateFare(service,route?.miles);
 const submit=async e=>{e.preventDefault();setError('');setLoading(true);const data=Object.fromEntries(new FormData(e.currentTarget));
  if(route){data.distanceMiles=Number(route.miles.toFixed(2));data.estimatedDuration=route.duration;data.estimatedFare=fare}
  try{const response=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to submit request.');setSummary({...result.booking,distanceMiles:data.distanceMiles,estimatedDuration:data.estimatedDuration,estimatedFare:data.estimatedFare})}catch(err){setError(err.message)}finally{setLoading(false)}};
 if(summary){return <div className="success" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true"/><h3 tabIndex="-1">Transportation request received</h3><p>Confirmation: <b>{summary.reference}</b></p><div className="summaryBox"><span><b>Status</b>{summary.statusLabel}</span><span><b>Service</b>{summary.service}</span><span><b>Trip</b>{summary.pickup} → {summary.destination}</span><span><b>Requested</b>{summary.date} at {summary.time}</span>{summary.distanceMiles&&<span><b>Distance</b>{Number(summary.distanceMiles).toFixed(1)} miles</span>}{summary.estimatedDuration&&<span><b>Estimated drive time</b>{summary.estimatedDuration}</span>}{summary.estimatedFare&&<span><b>Estimated fare</b>${Number(summary.estimatedFare).toFixed(2)}</span>}</div><p className="secureNote">Nexus will contact you to confirm availability and the final fare. Save the reference and open Livecare to follow every update.</p><PaymentOptions reference={summary.reference} fare={summary.estimatedFare}/><div className="successActions"><a className="outline" href={`/livecare.html?reference=${encodeURIComponent(summary.reference)}`}>Open Livecare</a><button type="button" className="outline" onClick={async()=>{await navigator.clipboard?.writeText(summary.reference);setCopyMessage('Reference copied to clipboard.')}}><ClipboardCopy size={17}/> Copy reference</button><button type="button" className="textButton" onClick={()=>setSummary(null)}>Submit another request</button></div><p className="srOnly" role="status" aria-live="polite">{copyMessage}</p></div>}
 return <form className="form bookingMapForm" onSubmit={submit} aria-busy={loading}><label>Name<input required name="name" autoComplete="name" maxLength="120"/></label><label>Phone<input required name="phone" type="tel" autoComplete="tel" maxLength="30"/></label><label>Email<input name="email" type="email" autoComplete="email" maxLength="180"/></label><label>Service<select required name="service" value={service} onChange={e=>setService(e.target.value)}><option value="">Choose a service</option>{services.map(s=><option key={s.title}>{s.title}</option>)}</select></label><label className="wide">Pickup<input ref={pickupRef} required name="pickup" autoComplete="off" maxLength="300" placeholder="Start typing a pickup address" onBlur={calculateRoute}/></label><label className="wide">Destination<input ref={destinationRef} required name="destination" autoComplete="off" maxLength="300" placeholder="Start typing a destination" onBlur={calculateRoute}/></label><div className="routePlanner wide"><div className="routePlannerHeader"><div><b>Trip route and fare estimate</b><span>{mapsReady?'Select both addresses to calculate mileage and ETA.':'Loading secure map services…'}</span></div><button type="button" className="outline compact" onClick={calculateRoute} disabled={!mapsReady}><Route size={17}/> Calculate route</button></div><div ref={mapRef} className="bookingMap" role="img" aria-label="Map showing the calculated route between pickup and destination"><div className="mapPlaceholder"><MapPin aria-hidden="true"/><span>Your route will appear here</span></div></div>{route&&<div className="routeMetrics" aria-live="polite"><span><b>Distance</b>{route.displayMiles}</span><span><b>Estimated drive time</b>{route.duration}</span><span><b>Estimated fare</b>{fare?`$${fare.toFixed(2)}`:'Select a service'}</span></div>}{mapError&&<div className="mapNotice" role="status">{mapError}</div>}</div><label>Date<input required name="date" type="date" min={tomorrow}/></label><label>Time<input required name="time" type="time"/></label><label className="wide">Mobility or coordination notes<textarea name="notes" rows="3" maxLength="2000"/></label><div className="mapNotice wide" role="note"><b>For emergencies, call 911.</b> Online requests are not confirmed until Nexus reviews availability, equipment, staffing and trip requirements.</div><label className="check wide"><input required name="consent" value="true" type="checkbox"/>I understand this request is not confirmed until Nexus contacts me.</label>{error&&<div className="apiError wide" role="alert">{error}</div>}<button type="submit" disabled={loading} className="primary xl wide">{loading?'Submitting…':'Submit Transportation Request'}</button></form>
}

function PartnerForm(){
 const [summary,setSummary]=useState(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
 const submit=async e=>{e.preventDefault();setError('');setLoading(true);const data=Object.fromEntries(new FormData(e.currentTarget));try{const response=await fetch('/api/partnerships',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to submit partnership request.');setSummary(result.partnership)}catch(err){setError(err.message)}finally{setLoading(false)}};
 if(summary){return <div className="success" role="status" aria-live="polite"><CheckCircle2 aria-hidden="true"/><h3>Partnership request received</h3><p>Reference: <b>{summary.reference}</b></p><div className="summaryBox"><span><b>Organization</b>{summary.organization}</span><span><b>Status</b>{summary.statusLabel}</span></div><p className="secureNote">A Nexus representative will follow up using the contact information provided.</p><button type="button" className="textButton" onClick={()=>setSummary(null)}>Submit another request</button></div>}
 return <form className="form" onSubmit={submit} aria-busy={loading}><label>Organization<input required name="organization" maxLength="180"/></label><label>Type<select required name="type" defaultValue=""><option value="">Choose</option><option>Hospital</option><option>Dialysis Center</option><option>Skilled Nursing</option><option>Assisted Living</option><option>Rehabilitation</option><option>Other</option></select></label><label>Contact name<input required name="contact" maxLength="120"/></label><label>Work email<input required name="email" type="email" maxLength="180"/></label><label>Phone<input required name="phone" type="tel" maxLength="30"/></label><label className="wide">Transportation needs<textarea required name="needs" rows="4" maxLength="3000"/></label>{error&&<div className="apiError wide" role="alert">{error}</div>}<button type="submit" disabled={loading} className="primary xl wide">{loading?'Submitting…':'Submit Partnership Request'}</button></form>
}
function TrackForm(){
 const [result,setResult]=useState(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
 const submit=async e=>{e.preventDefault();setError('');setLoading(true);const data=Object.fromEntries(new FormData(e.currentTarget));try{const response=await fetch(`/api/bookings/${encodeURIComponent(data.reference)}?phone=${encodeURIComponent(data.phone)}`);const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Request not found.');setResult(payload.booking)}catch(err){setError(err.message);setResult(null)}finally{setLoading(false)}};
 if(result)return <div className="trackResult" role="status" aria-live="polite"><div className="trackStatus"><span className="statusPulse"/><div><small>Current status</small><h3>{result.statusLabel}</h3></div></div><div className="summaryBox"><span><b>Reference</b>{result.reference}</span><span><b>Service</b>{result.service}</span><span><b>Requested trip</b>{result.pickup} → {result.destination}</span><span><b>Date / time</b>{result.date} at {result.time}</span>{result.driverName&&<span><b>Driver</b>{result.driverName}</span>}{result.vehicleUnit&&<span><b>Vehicle</b>{result.vehicleUnit}</span>}</div><button type="button" className="textButton" onClick={()=>setResult(null)}>Track another request</button></div>;
 return <form className="form" onSubmit={submit} aria-busy={loading}><label className="wide">Confirmation reference<input required name="reference" placeholder="NMT-20260715-0001" autoCapitalize="characters"/></label><label className="wide">Phone number<input required name="phone" type="tel"/></label>{error&&<div className="apiError wide" role="alert">{error}</div>}<button type="submit" disabled={loading} className="primary xl wide">{loading?'Checking…':'Check Request Status'}</button></form>
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
