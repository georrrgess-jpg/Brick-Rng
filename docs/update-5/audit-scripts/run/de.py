import sys, itertools, math
from PIL import Image
def lab(rgb):
    def f(c):
        c/=255; return ((c+0.055)/1.055)**2.4 if c>0.04045 else c/12.92
    r,g,b=[f(x) for x in rgb]
    X=(0.4124*r+0.3576*g+0.1805*b)/0.95047; Y=0.2126*r+0.7152*g+0.0722*b; Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    g_=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*g_(Y)-16, 500*(g_(X)-g_(Y)), 200*(g_(Y)-g_(Z)))
def de2000(l1,l2):
    L1,a1,b1=l1;L2,a2,b2=l2
    C1=math.hypot(a1,b1);C2=math.hypot(a2,b2);Cb=(C1+C2)/2
    G=0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7)))
    a1p=(1+G)*a1;a2p=(1+G)*a2
    C1p=math.hypot(a1p,b1);C2p=math.hypot(a2p,b2)
    h1p=math.degrees(math.atan2(b1,a1p))%360;h2p=math.degrees(math.atan2(b2,a2p))%360
    dLp=L2-L1;dCp=C2p-C1p
    dh=h2p-h1p
    if C1p*C2p==0: dh=0
    elif dh>180: dh-=360
    elif dh<-180: dh+=360
    dHp=2*math.sqrt(C1p*C2p)*math.sin(math.radians(dh/2))
    Lbp=(L1+L2)/2;Cbp=(C1p+C2p)/2
    hbp=h1p+h2p
    if C1p*C2p!=0:
        if abs(h1p-h2p)>180: hbp=(hbp+360)/2 if hbp<360 else (hbp-360)/2
        else: hbp/=2
    T=1-0.17*math.cos(math.radians(hbp-30))+0.24*math.cos(math.radians(2*hbp))+0.32*math.cos(math.radians(3*hbp+6))-0.20*math.cos(math.radians(4*hbp-63))
    dth=30*math.exp(-((hbp-275)/25)**2)
    Rc=2*math.sqrt(Cbp**7/(Cbp**7+25**7))
    Sl=1+0.015*(Lbp-50)**2/math.sqrt(20+(Lbp-50)**2);Sc=1+0.045*Cbp;Sh=1+0.015*Cbp*T
    Rt=-math.sin(math.radians(2*dth))*Rc
    return math.sqrt((dLp/Sl)**2+(dCp/Sc)**2+(dHp/Sh)**2+Rt*(dCp/Sc)*(dHp/Sh))
names=['red','blue','green','yellow','purple','orange','aqua']
res=[]
for path in sys.argv[1:]:
    im=Image.open(path).convert('RGB'); w,h=im.size
    cell=(w-2*w*0.022)/8; x0=w*0.022; y0=h*0.022
    # sample 8 rows: row r col c has color (c+3r)%7 ; take average over the brick's inner area excluding center 30%
    acc={k:[0,0,0,0] for k in range(7)}
    for r in range(8):
        for c in range(8):
            col=(c+3*r)%7
            bx=int(x0+c*cell); by=int(y0+r*cell)
            tile=im.crop((bx+int(cell*0.15),by+int(cell*0.15),bx+int(cell*0.85),by+int(cell*0.85))).resize((1,1),Image.BOX).getpixel((0,0))
            a=acc[col]; a[0]+=tile[0];a[1]+=tile[1];a[2]+=tile[2];a[3]+=1
    labs={k:lab([v/acc[k][3] for v in acc[k][:3]]) for k in acc}
    pairs=sorted(((de2000(labs[i],labs[j]),names[i]+'/'+names[j]) for i,j in itertools.combinations(range(7),2)))
    res.append((pairs[0][0],path.split('k_skin_')[1].replace('_rest.png',''),pairs[:3]))
for m,n,p in sorted(res):
    print(f'{n:12s} min dE2000 {m:5.1f}  ' + ', '.join(f'{x[1]} {x[0]:.1f}' for x in p))
