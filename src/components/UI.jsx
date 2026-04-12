import { C, fmt } from "../constants";

export const inp = {
  width:"100%", padding:"9px 12px", borderRadius:8,
  border:`1.5px solid ${C.gray200}`, fontSize:13, outline:"none",
  boxSizing:"border-box", background:C.white, color:C.black,
  fontFamily:"'Montserrat', sans-serif",
  transition:"border-color 0.15s",
};

export const Field = ({label,children,hint}) => (
  <div>
    <div style={{fontSize:11,fontWeight:600,color:C.gray500,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
    {children}
    {hint&&<div style={{fontSize:11,color:C.gray400,marginTop:3}}>{hint}</div>}
  </div>
);

export const Grid2 = ({children,gap="12px 16px"}) => (
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap}}>{children}</div>
);

export const Sec = ({title,children}) => (
  <div style={{marginBottom:20}}>
    <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:10,textTransform:"uppercase",letterSpacing:0.8}}>{title}</div>
    {children}
  </div>
);

export const Badge = ({children,color="gray",style={}}) => {
  const colors = {
    gray:{bg:C.gray100,text:C.gray600},
    red:{bg:C.redLight,text:C.red},
    green:{bg:C.greenLight,text:C.green},
    amber:{bg:C.amberLight,text:C.amber},
    blue:{bg:C.blueLight,text:C.blue},
  };
  const col = colors[color]||colors.gray;
  return (
    <span style={{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:500,background:col.bg,color:col.text,...style}}>
      {children}
    </span>
  );
};

export const Stat = ({label,value,sub,color,alert,trend}) => (
  <div style={{background:C.white,border:`1px solid ${alert?C.red:C.gray200}`,borderRadius:12,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
    {alert&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:C.red,borderRadius:"12px 12px 0 0"}}/>}
    <div style={{fontSize:11,fontWeight:600,color:C.gray500,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>{label}</div>
    <div style={{fontSize:22,fontWeight:800,color:color||C.black,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:12,color:C.gray500,marginTop:6}}>{sub}</div>}
    {trend!==undefined&&(
      <div style={{fontSize:11,color:trend>=0?C.green:C.red,marginTop:4,fontWeight:500}}>
        {trend>=0?"↑":"↓"} {Math.abs(trend)}%
      </div>
    )}
  </div>
);

export const Card = ({children,style={},onClick}) => (
  <div onClick={onClick} style={{background:C.white,border:`1px solid ${C.gray200}`,borderRadius:12,padding:"16px 18px",cursor:onClick?"pointer":"default",transition:"border-color 0.15s",...style}}
    onMouseEnter={onClick?e=>{e.currentTarget.style.borderColor=C.red;}:null}
    onMouseLeave={onClick?e=>{e.currentTarget.style.borderColor=style.border?style.border.split(" ").pop():C.gray200;}:null}>
    {children}
  </div>
);

export const Btn = ({children,onClick,variant="outline",size="md",disabled,style={}}) => {
  const sizes = {sm:{padding:"5px 12px",fontSize:12},md:{padding:"8px 16px",fontSize:13},lg:{padding:"11px 22px",fontSize:14}};
  const variants = {
    primary:{background:C.red,color:C.white,border:"none"},
    outline:{background:"transparent",color:C.gray600,border:`1px solid ${C.gray200}`},
    ghost:{background:"transparent",color:C.gray600,border:"none"},
    danger:{background:C.redLight,color:C.red,border:`1px solid ${C.red}`},
    success:{background:C.greenLight,color:C.green,border:`1px solid ${C.green}`},
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{...sizes[size],...variants[variant],borderRadius:8,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,display:"inline-flex",alignItems:"center",gap:6,transition:"all 0.15s",fontFamily:"'Montserrat', sans-serif",...style}}
      onMouseEnter={!disabled?e=>{if(variant==="primary")e.currentTarget.style.background=C.redDark;if(variant==="outline"){e.currentTarget.style.borderColor=C.red;e.currentTarget.style.color=C.red;}}:null}
      onMouseLeave={!disabled?e=>{if(variant==="primary")e.currentTarget.style.background=C.red;if(variant==="outline"){e.currentTarget.style.borderColor=C.gray200;e.currentTarget.style.color=C.gray600;}}:null}>
      {children}
    </button>
  );
};

export const PieChart = ({value,max,label,color=C.red,size=110}) => {
  const r=46,cx=size/2,cy=size/2;
  const p=max>0?Math.min(value/max,1):0;
  const angle=p*2*Math.PI;
  const x=cx+r*Math.sin(angle),y=cy-r*Math.cos(angle);
  const large=angle>Math.PI?1:0;
  const path=p>=1?`M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx-0.01} ${cy-r} Z`
    :`M ${cx} ${cy-r} A ${r} ${r} 0 ${large} 1 ${x} ${y} L ${cx} ${cy} Z`;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill={C.gray100}/>
        {p>0&&<path d={path} fill={color} opacity="0.9"/>}
        <circle cx={cx} cy={cy} r={30} fill={C.white}/>
        <text x={cx} y={cy-4} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.gray900}>{Math.round(p*100)}%</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="9" fill={C.gray400}>objetivo</text>
      </svg>
      <div style={{fontSize:12,color:C.gray500,marginTop:2,fontWeight:500}}>{label}</div>
      <div style={{fontSize:13,fontWeight:700,color}}>{fmt(value)}</div>
      <div style={{fontSize:10,color:C.gray400}}>de {fmt(max)}</div>
    </div>
  );
};

export const BarChart = ({data,height=100}) => {
  if(!data?.length) return null;
  const max=Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:8,height:height+36,padding:"0 4px"}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          {d.value>0&&<div style={{fontSize:9,color:C.gray400,fontWeight:500,textAlign:"center"}}>{fmt(d.value)}</div>}
          <div style={{width:"100%",background:d.highlight?C.red:C.gray200,borderRadius:"6px 6px 0 0",height:Math.max((d.value/max)*height,2),transition:"height 0.4s ease"}}/>
          <div style={{fontSize:9,color:C.gray400,textAlign:"center",lineHeight:1.3}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

export const ProgressBar = ({value,max,color=C.red,showLabel=true}) => {
  const p = max>0?Math.min(Math.round((value/max)*100),100):0;
  return (
    <div>
      {showLabel&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.gray500,marginBottom:4}}>
        <span>{fmt(value)}</span><span>{p}%</span>
      </div>}
      <div style={{height:6,background:C.gray100,borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${p}%`,background:color,borderRadius:3,transition:"width 0.4s ease"}}/>
      </div>
    </div>
  );
};

export const Modal = ({children,onClose,maxWidth=640}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={onClose}>
    <div style={{background:C.white,borderRadius:16,width:"100%",maxWidth,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      {children}
    </div>
  </div>
);

export const ModalHeader = ({title,subtitle,onClose}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px 16px",borderBottom:`1px solid ${C.gray200}`}}>
    <div>
      <div style={{fontSize:20,fontWeight:700,color:C.black}}>{title}</div>
      {subtitle&&<div style={{fontSize:13,color:C.gray500,marginTop:3}}>{subtitle}</div>}
    </div>
    <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.gray500,fontSize:20,lineHeight:1,padding:"2px 4px",borderRadius:6,transition:"color 0.15s",fontFamily:"'Montserrat', sans-serif"}}
      onMouseEnter={e=>e.currentTarget.style.color=C.black}
      onMouseLeave={e=>e.currentTarget.style.color=C.gray500}>×</button>
  </div>
);

export const ModalBody = ({children}) => (
  <div style={{padding:"20px 24px"}}>{children}</div>
);

export const ModalFooter = ({children}) => (
  <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"16px 24px",borderTop:`1px solid ${C.gray200}`}}>
    {children}
  </div>
);

export const Table = ({cols,rows,emptyMsg="Sin datos"}) => (
  <div style={{background:C.white,border:`1px solid ${C.gray200}`,borderRadius:12,overflow:"hidden"}}>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:cols.length*100}}>
        <thead>
          <tr style={{background:C.gray50,borderBottom:`1px solid ${C.gray200}`}}>
            {cols.map(c=><th key={c.key||c} style={{padding:"11px 14px",textAlign:"left",fontWeight:600,fontSize:11,color:C.gray500,textTransform:"uppercase",letterSpacing:0.5,whiteSpace:"nowrap"}}>{c.label||c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length===0&&<tr><td colSpan={cols.length} style={{padding:"2rem",textAlign:"center",color:C.gray500,fontSize:13}}>{emptyMsg}</td></tr>}
          {rows.map((row,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${C.gray200}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.redLight}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {cols.map(c=>(
                <td key={c.key||c} style={{padding:"10px 14px",whiteSpace:c.wrap?"normal":"nowrap",color:C.gray700}}>{row[c.key||c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const Spinner = () => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4rem",gap:12}}>
    <div style={{width:32,height:32,border:`3px solid ${C.gray200}`,borderTop:`3px solid ${C.red}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontSize:13,color:C.gray400}}>Cargando...</div>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export const EmptyState = ({icon="📭",title,desc,action}) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"4rem 2rem",textAlign:"center"}}>
    <div style={{fontSize:40,marginBottom:12}}>{icon}</div>
    <div style={{fontSize:15,fontWeight:600,color:C.gray600,marginBottom:6}}>{title}</div>
    {desc&&<div style={{fontSize:13,color:C.gray500,marginBottom:16}}>{desc}</div>}
    {action}
  </div>
);
