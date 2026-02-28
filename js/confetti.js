/*
  confetti.js - EXPLOSION INSTANTANEA
  Fase 1: CSS puro (t=0) - divs animados por compositor del browser.
  Fase 2: Canvas rectangulos para lluvia (t=400ms).
  Sin emojis. Sin corazones. Velocidad maxima.
*/
(function () {

var COLORS = [
    '#f9a8d4','#f472b6','#ec4899','#db2777',
    '#93c5fd','#60a5fa','#3b82f6','#818cf8',
    '#fff','#fde68a','#c4b5fd','#fbcfe8'
];

var cv, cx, parts, rafId, running;
var styleInjected = false;

function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var s = document.createElement('style');
    s.textContent =
        '@keyframes cffly{0%{transform:translate(0,0) rotate(0deg);opacity:1}'
        +'100%{transform:translate(var(--dx),var(--dy)) rotate(var(--dr));opacity:0}}'
        +'.cfp{position:fixed;pointer-events:none;z-index:1000;'
        +'border-radius:var(--br);width:var(--w);height:var(--h);'
        +'background:var(--c);top:var(--ty);left:var(--tx);'
        +'animation:cffly var(--t) ease-out forwards}';
    document.head.appendChild(s);
}

function cssBurst(ox, oy, n) {
    var frag = document.createDocumentFragment();
    var i, el, ang, spd, dx, dy;
    for (i = 0; i < n; i++) {
        el  = document.createElement('div');
        ang = Math.random() * 6.2832;
        spd = 100 + Math.random() * 300;
        dx  = Math.cos(ang) * spd;
        dy  = Math.sin(ang) * spd - (60 + Math.random() * 140);
        el.className = 'cfp';
        el.style.cssText =
            '--tx:'+ox+'px;--ty:'+oy+'px;'
            +'--dx:'+dx+'px;--dy:'+dy+'px;'
            +'--dr:'+((Math.random()-0.5)*720)+'deg;'
            +'--w:'+(4+Math.random()*8)+'px;'
            +'--h:'+(2+Math.random()*5)+'px;'
            +'--br:'+(Math.random()<0.4?'50%':'2px')+';'
            +'--c:'+COLORS[(Math.random()*COLORS.length)|0]+';'
            +'--t:'+(0.55+Math.random()*0.55)+'s';
        frag.appendChild(el);
    }
    document.body.appendChild(frag);
    setTimeout(function(){
        var old=document.querySelectorAll('.cfp');
        for(var j=0;j<old.length;j++) old[j].remove();
    }, 1600);
}

function cssWave() {
    var W = window.innerWidth, H = window.innerHeight;
    cssBurst(W*0.10, H*0.55, 35);
    cssBurst(W*0.32, H*0.15, 45);
    cssBurst(W*0.50, H*0.08, 55);
    cssBurst(W*0.68, H*0.15, 45);
    cssBurst(W*0.90, H*0.55, 35);
}

function initCanvas() {
    if (cv) return;
    cv = document.getElementById('confetti-canvas');
    if (!cv) return;
    cx = cv.getContext('2d');
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
    window.addEventListener('resize', function(){
        if(cv){cv.width=window.innerWidth;cv.height=window.innerHeight;}
    });
}

function mkp(x, y) {
    var a=Math.random()*6.2832, s=5+Math.random()*9;
    return [
        x, y,
        Math.cos(a)*s, Math.sin(a)*s-7,
        (Math.random()*COLORS.length)|0,
        3+Math.random()*7, 2+Math.random()*4,
        Math.random()*360, (Math.random()-0.5)*12,
        1, 0.007+Math.random()*0.006
    ];
}

var rainN = 0;
function addRain() {
    if (!cv) return;
    for (var i=0; i<5; i++) {
        var p=mkp(Math.random()*cv.width, -10);
        p[2]=(Math.random()-0.5)*3;
        p[3]=1.5+Math.random()*3;
        p[10]=0.003+Math.random()*0.003;
        parts.push(p);
    }
    if (++rainN < 70) setTimeout(addRain, 100);
}

function loop() {
    if (!cx) return;
    cx.clearRect(0,0,cv.width,cv.height);
    var i=parts.length, p;
    while(i--) {
        p=parts[i];
        p[3]+=0.32; p[2]*=0.99;
        p[0]+=p[2]; p[1]+=p[3];
        p[7]+=p[8]; p[9]-=p[10];
        if(p[9]<=0||p[1]>cv.height+20){parts.splice(i,1);continue;}
        cx.save();
        cx.globalAlpha=p[9];
        cx.fillStyle=COLORS[p[4]];
        cx.translate(p[0],p[1]);
        cx.rotate(p[7]*0.01745);
        cx.fillRect(-p[5]*0.5,-p[6]*0.5,p[5],p[6]);
        cx.restore();
    }
    if(parts.length>0) rafId=requestAnimationFrame(loop);
    else running=false;
}

function goCanvas() {
    if (!running) { running=true; rafId=requestAnimationFrame(loop); }
}

window.launchConfetti = function() {
    injectStyles();
    initCanvas();
    parts=[]; rainN=0; running=false;

    cssWave();
    setTimeout(cssWave, 280);
    setTimeout(cssWave, 560);

    setTimeout(function(){
        goCanvas(); rainN=0; addRain();
    }, 450);

    setTimeout(function(){
        cssWave();
        setTimeout(cssWave,260);
        goCanvas(); rainN=0; addRain();
    }, 3500);

    setTimeout(function(){
        cssWave();
        setTimeout(cssWave,260);
    }, 7000);
};

}());