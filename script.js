(function(){
  var root = document.documentElement;
  var intro = document.getElementById('top');
  var stage = document.getElementById('stage');
  var nav   = document.getElementById('nav');
  var h1    = document.getElementById('name');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('y').textContent = new Date().getFullYear();
  root.classList.add('js');

  function clamp(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ==========================================================================
     SINTETIZZATORE AUDIO WEB (Zero dipendenze esterne!)
     ========================================================================== */
  var audioCtx = null;

  function initAudio(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx && audioCtx.state === 'suspended'){
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, vol){
    try{
      initAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      var v = vol || 0.12;
      gain.gain.setValueAtTime(v, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }catch(e){}
  }

  function soundPop(){
    playTone(520, 'sine', 0.1, 0.14);
  }

  function soundBoing(){
    try{
      initAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.28);
    }catch(e){}
  }

  function soundNote(index){
    var notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    var f = notes[index % notes.length];
    playTone(f, 'sine', 0.24, 0.15);
  }

  function soundFanfare(){
    var fan = [261.63, 329.63, 392.00, 523.25];
    fan.forEach(function(f, i){
      setTimeout(function(){ playTone(f, 'triangle', 0.35, 0.18); }, i * 90);
    });
  }


  /* ==========================================================================
     SISTEMA PARTICELLE & CORIANDOLI (CANVAS 2D ULTRA-LEGGERO)
     ========================================================================== */
  var canvas = document.getElementById('fx-canvas');
  var ctx = canvas.getContext('2d');
  var particles = [];
  var isRendering = false;

  function resizeCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  var MAX_PARTICLES = 240;
  var spriteCache = {};
  var lastFrame = 0;

  // Ogni emoji viene disegnata UNA volta su un mini-canvas; poi si copia (molto più veloce di fillText a ogni frame)
  function getSprite(ch, size){
    var q = Math.round(size / 4) * 4;
    var key = ch + '|' + q;
    var sp = spriteCache[key];
    if(!sp){
      var dim = Math.ceil(q * 1.5);
      sp = document.createElement('canvas');
      sp.width = sp.height = dim;
      var c = sp.getContext('2d');
      c.font = q + 'px serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(ch, dim / 2, dim / 2);
      spriteCache[key] = sp;
    }
    return sp;
  }

  function spawnBurst(x, y, count, emojis){
    if(reduce) return;   // chi ha chiesto meno animazioni non vede esplosioni
    var colors = ['#ffb38a', '#6c4cff', '#a98bff', '#ffd166', '#06d6a0', '#ff3366'];
    var useEmoji = Array.isArray(emojis) && emojis.length > 0;
    // Se ci sono già tante particelle ne creo meno, e butto le più vecchie oltre il tetto
    count = Math.min(count, MAX_PARTICLES);
    if(particles.length > 140) count = Math.ceil(count / 2);
    var overflow = particles.length + count - MAX_PARTICLES;
    if(overflow > 0) particles.splice(0, overflow);

    for(var i = 0; i < count; i++){
      var angle = Math.random() * Math.PI * 2;
      var speed = Math.random() * 8 + 3;
      var size = useEmoji ? (Math.random() * 12 + 18) : (Math.random() * 6 + 5);
      var ch = useEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : null;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: size,
        color: colors[Math.floor(Math.random() * colors.length)],
        sprite: ch ? getSprite(ch, size) : null,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }
    if(!isRendering){
      isRendering = true;
      lastFrame = performance.now();
      root.classList.add('fx-busy');
      requestAnimationFrame(renderParticles);
    }
  }

  function renderParticles(now){
    var dt = Math.min(2.5, (now - lastFrame) / 16.667 || 1);   // la velocità non dipende dagli fps
    lastFrame = now;
    var decay = Math.pow(0.98, dt);
    var h = canvas.height;

    ctx.clearRect(0, 0, canvas.width, h);
    var alive = 0;
    for(var i = 0; i < particles.length; i++){
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.28 * dt;   // gravità
      p.vx *= decay;
      p.rotation += p.rotSpeed * dt;
      p.alpha -= 0.016 * dt;
      if(p.alpha <= 0 || p.y > h + 50) continue;
      particles[alive++] = p;

      var rad = p.rotation * Math.PI / 180;
      var cs = Math.cos(rad), sn = Math.sin(rad);
      ctx.globalAlpha = p.alpha;
      ctx.setTransform(cs, sn, -sn, cs, p.x, p.y);
      if(p.sprite){
        var d = p.sprite.width;
        ctx.drawImage(p.sprite, -d / 2, -d / 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, 6.2832);
        ctx.fill();
      }
    }
    particles.length = alive;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    if(alive > 0){
      requestAnimationFrame(renderParticles);
    } else {
      isRendering = false;
      root.classList.remove('fx-busy');
      ctx.clearRect(0, 0, canvas.width, h);
    }
  }

  /* ==========================================================================
     TOAST NOTIFICHE
     ========================================================================== */
  var toastContainer = document.getElementById('toast-container');
  function showToast(text, duration){
    var d = duration || 2600;
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = text;
    while(toastContainer.children.length >= 3) toastContainer.removeChild(toastContainer.firstChild);
    toastContainer.appendChild(t);
    setTimeout(function(){
      t.style.animation = 'toastOut 0.3s forwards';
      setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, d);
  }

  /* ==========================================================================
     HERO: BOTTONE FUGGITIVO BIRICHINO "NON SCRIVERMI!"
     ========================================================================== */
  var btnRunaway = document.getElementById('btnRunaway');
  var runawayCount = 0;
  var runawayPhrases = [
    'Quasi preso. 😔',
    'Troppo lento! 🥱',
    'Ho detto NON scrivermi! 🛑',
    'Anche tu disoccupato? 😶‍🌫️',
    'Ok ok, mi arrendo, cliccami. 😭'
  ];

  function dodge(e){
    if(runawayCount >= 4) return;
    runawayCount++;
    soundBoing();
    var rect = btnRunaway.getBoundingClientRect();
    var maxOffset = 110;
    var dx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * maxOffset + 50);
    var dy = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 60 + 20);

    btnRunaway.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    btnRunaway.textContent = runawayPhrases[runawayCount - 1];

    var bX = rect.left + rect.width / 2;
    var bY = rect.top + rect.height / 2;
    spawnBurst(bX, bY, 8, ['💨', '✨', '⚡']);

    if(runawayCount >= 4){
      setTimeout(function(){
        btnRunaway.style.transform = 'none';
        btnRunaway.textContent = 'Ok ok, mi arrendo, cliccami. 😭';
        unlock('runaway');
      }, 700);
    }
  }

  btnRunaway.addEventListener('mouseenter', dodge);
  btnRunaway.addEventListener('click', function(e){
    e.preventDefault();
    if(runawayCount < 4){
      dodge(e);
    } else {
      showToast('Qui mi puoi (sfortunatamente) scrivere...');
      soundPop();
      btnRunaway.style.display = 'none';
      var mLink = document.getElementById('mailLink');
      if(mLink){
        mLink.style.display = 'inline-block';
        mLink.classList.add('in');
        mLink.style.opacity = '1';
        mLink.style.animation = 'toastIn .5s cubic-bezier(.34,1.56,.64,1) forwards';
        var rect = mLink.getBoundingClientRect();
        spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 25, ['✉️', '🎉', '✨', '💖']);
      }
    }
  });

  /* Cliccando su Francy nell'hero si scatena una festa */
  h1.addEventListener('click', function(e){
    soundPop();
    spawnBurst(e.clientX, e.clientY, 25, ['🦩', '✨', '🍍', '🕶️', '🌴', '🍕']);
    showToast('✨ 100% Esoticità garantita!');
  });

  document.getElementById('badgeExotic').addEventListener('click', function(e){
    soundFanfare();
    var b = this.getBoundingClientRect();
    spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 20, ['🔥', '✨', '⚡', '🌟']);
    showToast('🌟 Sovraccarico Esotico Raggiunto!');
  });

  document.getElementById('logoBtn').addEventListener('click', function(e){
    soundPop();
    var b = this.getBoundingClientRect();
    spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 12, ['🦩', '💖', '✨']);
  });

  /* ==========================================================================
     CHI NON SONO (GENERATORE IDENTITÀ ASSURDE)
     ========================================================================== */
  var whoText = document.getElementById('whoText');
  var btnOtherWho = document.getElementById('btnOtherWho');
  var whoList = [
    'Paolo Bonolis.',
    'Gerry Scotti che conduce una missione su Marte.',
    'Il tuo commercialista che cerca gli scontrini del 2017.',
    'Tre procioni in un impermeabile che fingono di programmare in C++.',
    'L\'inventore della pizza con ananas e maionese (per fortuna).',
    'Batman, ma solo il martedì tra le 14:00 e le 15:30.',
    'Un tostapane smart con una profonda crisi d\'identità.',
    'Alberto Angela durante uno scavo archeologico sul divano.'
  ];
  var whoIdx = 0;

  btnOtherWho.addEventListener('click', function(e){
    soundPop();
    whoIdx = (whoIdx + 1) % whoList.length;
    whoText.style.opacity = '0';
    whoText.style.transform = 'translateY(-8px)';
    whoText.style.transition = 'opacity .2s, transform .2s';
    setTimeout(function(){
      whoText.textContent = whoList[whoIdx];
      whoText.style.opacity = '1';
      whoText.style.transform = 'translateY(0)';
    }, 200);
    var b = btnOtherWho.getBoundingClientRect();
    spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 8, ['🎲', '✨']);
  });

  /* ==========================================================================
     GAMIFICATION: SKILL CLICKER & XP FARMING
     ========================================================================== */
  var currentXp = 0;
  var xpCountEl = document.getElementById('xpCount');
  var xpFillEl = document.getElementById('xpFill');
  var xpRankEl = document.getElementById('xpRank');
  var xpNextEl = document.getElementById('xpNext');

  var ranks = [
    { threshold: 0, title: 'Disoccupato Principiante' },
    { threshold: 300, title: 'Apprendista del Boss ' },
    { threshold: 900, title: 'Maestro di Disoccupaggine' },
    { threshold: 2000, title: 'Quasi Boss' },
    { threshold: 4000, title: 'UNEMPLOYED FINAL BOSS 👑' }
  ];

  var restoring = false;
  var achReady = false;
  function addXp(amount, clientX, clientY){
    currentXp += amount;
    try{ localStorage.setItem('fra:xp', String(currentXp)); }catch(e){}
    xpCountEl.textContent = currentXp;

    // Aggiorna grado
    var currentRank = ranks[0].title;
    var nextThreshold = ranks[1].threshold;
    for(var i = 0; i < ranks.length; i++){
      if(currentXp >= ranks[i].threshold){
        currentRank = ranks[i].title;
        nextThreshold = (i + 1 < ranks.length) ? ranks[i + 1].threshold : null;
      }
    }

    if(xpRankEl.textContent !== currentRank){
      xpRankEl.textContent = currentRank;
      if(!restoring){   // al ripristino dei progressi niente festeggiamenti
        showToast('🎉 PROMOZIONE! Nuovo rango: ' + currentRank, 3200);
        soundFanfare();
        spawnBurst(clientX || window.innerWidth / 2, clientY || window.innerHeight / 2, 25, ['🏆', '✨', '👑']);
      }
    }

    if(achReady && currentRank === ranks[ranks.length - 1].title) unlock('boss');

    if(nextThreshold){
      var prev = 0;
      for(var j = 0; j < ranks.length; j++){
        if(ranks[j].title === currentRank) prev = ranks[j].threshold;
      }
      var pct = Math.min(100, Math.round(((currentXp - prev) / (nextThreshold - prev)) * 100));
      xpFillEl.style.width = pct + '%';
      xpNextEl.textContent = 'Prossimo rango a ' + nextThreshold + ' XP';
    } else {
      xpFillEl.style.width = '100%';
      xpNextEl.textContent = 'Livello Massimo Raggiunto! Sei troppo disoccupato.';
    }

    // Badge fluttuante "+XP"
    if(clientX && clientY){
      var f = document.createElement('div');
      f.className = 'floating-xp';
      f.textContent = '+' + amount + ' XP';
      f.style.left = clientX + 'px';
      f.style.top = clientY + 'px';
      document.body.appendChild(f);
      setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 900);
    }
  }

  var skillItems = document.querySelectorAll('#skillsList li');
  skillItems.forEach(function(item, idx){
    item.addEventListener('click', function(e){
      var xpVal = parseInt(item.getAttribute('data-xp') || '20', 10);
      item.classList.add('popped');
      setTimeout(function(){ item.classList.remove('popped'); }, 350);
      soundNote(idx);
      spawnBurst(e.clientX, e.clientY, 10, ['✨', '⭐', '🎈']);
      addXp(xpVal, e.clientX, e.clientY);
    });
  });

  // Ripristina i progressi dell'ultima visita
  try{
    var savedXp = parseInt(localStorage.getItem('fra:xp') || '0', 10);
    if(savedXp > 0){ restoring = true; addXp(savedXp); restoring = false; }
  }catch(e){ restoring = false; }

  // Accessibilità: gli elementi cliccabili che non sono pulsanti si usano anche da tastiera
  [].slice.call(document.querySelectorAll('#skillsList li, #badgeExotic')).forEach(function(el){
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        var b = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent('click', {bubbles:true, clientX:b.left + b.width / 2, clientY:b.top + b.height / 2}));
      }
    });
  });

  /* ==========================================================================
     SALA GIOCHI: 1. IL PULSANTE PROIBITO
     ========================================================================== */
  var btnForbidden = document.getElementById('btnForbidden');
  var forbiddenStatus = document.getElementById('forbiddenStatus');
  var forbiddenClicks = 0;
  var forbiddenMessages = [
    'Pressioni vietate: 1 (Fermati finché sei in tempo)',
    'Pressioni vietate: 2 (Ti stai assumendo enormi rischi)',
    'Pressioni vietate: 3 (Mario Roggero si è allarmato)',
    'Pressioni vietate: 4 (Il Pacciani sta arrivando...)',
    'Pressioni vietate: 5 (Ora vedrai come uno strafatto)'
  ];

  btnForbidden.addEventListener('click', function(e){
    forbiddenClicks++;
    soundPop();
    document.body.classList.add('shake');
    setTimeout(function(){ document.body.classList.remove('shake'); }, 400);

    var rect = btnForbidden.getBoundingClientRect();
    spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 14, ['💥', '⚠️', '🔥']);

    if(forbiddenClicks < forbiddenMessages.length){
      forbiddenStatus.textContent = forbiddenMessages[forbiddenClicks - 1];
    } else {
      forbiddenStatus.textContent = 'LSD SIMULATOR 🌈';
      document.body.classList.toggle('party-mode');
      soundFanfare();
      spawnBurst(window.innerWidth / 2, window.innerHeight / 2, 50, ['🪩', '🎉', '🌴', '🍍', '🕶️', '⚡']);
      showToast('LSD SIMULATOR 🌈');
      addXp(80, e.clientX, e.clientY);
      unlock('forbidden');
    }
  });

  /* ==========================================================================
     SALA GIOCHI: 2. L'ORACOLO DELLE SCUSE
     ========================================================================== */
  var oracleQuote = document.getElementById('oracleQuote');
  var btnNewExcuse = document.getElementById('btnNewExcuse');
  var btnCopyExcuse = document.getElementById('btnCopyExcuse');

  var excuses = [
    '"Il codice funzionava benissimo, poi Mercurio è entrato in retrogrado."',
    '"Il mio gatto sta sostenendo un esame orale di diritto privato su Zoom."',
    '"Non posso lavorare: sto aspettando che si asciughi l\'inchiostro del codice digitale."',
    '"Il compilatore si è offeso per un punto e virgola di troppo e non mi parla più."',
    '"Ho appena scoperto che procrastinare brucia calorie mentali. Sono a dieta."',
    '"La tastiera ha finito l\'inchiostro per le vocali."',
    '"Oggi sono in modalità sciopero esotico permanente."'
  ];
  var excuseIdx = 0;

  function newExcuse(){
    soundPop();
    excuseIdx = (excuseIdx + 1) % excuses.length;
    oracleQuote.style.opacity = '0';
    setTimeout(function(){
      oracleQuote.textContent = excuses[excuseIdx];
      oracleQuote.style.opacity = '1';
    }, 150);
  }

  btnNewExcuse.addEventListener('click', function(e){
    newExcuse();
    var b = this.getBoundingClientRect();
    spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 6, ['🔮', '✨']);
  });

  btnCopyExcuse.addEventListener('click', function(){
    soundPop();
    var text = oracleQuote.textContent.replace(/^"|"$/g, '');
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text);
      showToast('📋 Scusa copiata negli appunti! Mandagliela con orgoglio.');
    } else {
      showToast('📋 Scusa pronta da declamare a voce!');
    }
  });

  /* ==========================================================================
     SALA GIOCHI: 3. ACCHIAPPA IL NERO (MINI-GAME)
     ========================================================================== */
  var clickerArea = document.getElementById('clickerArea');
  var btnStartClicker = document.getElementById('btnStartClicker');
  var gameTimerEl = document.getElementById('gameTimer');
  var gameScoreEl = document.getElementById('gameScore');
  var gameRecordEl = document.getElementById('gameRecord');
  var clickerPrompt = document.getElementById('clickerPrompt');

  var gameActive = false;
  var gameScore = 0;
  var gameHighscore = 0;
  var gameTimeLeft = 15;
  var gameInterval = null;
  var currentTarget = null;
  var exoticEmojis = ['👩🏿', '👨🏿', '🧑🏿', '👧🏿', '👦🏿', '🧒🏿', '👶🏿', '🧑🏿‍🦰'];

  function spawnTarget(){
    if(!gameActive) return;
    if(currentTarget && currentTarget.parentNode){
      currentTarget.parentNode.removeChild(currentTarget);
    }
    var target = document.createElement('div');
    target.className = 'clicker-target';
    target.textContent = exoticEmojis[Math.floor(Math.random() * exoticEmojis.length)];

    var w = clickerArea.clientWidth - 45;
    var h = clickerArea.clientHeight - 45;
    var x = Math.max(10, Math.random() * w);
    var y = Math.max(10, Math.random() * h);

    target.style.left = x + 'px';
    target.style.top = y + 'px';

    target.addEventListener('pointerdown', function(e){
      if(!gameActive) return;
      gameScore++;
      gameScoreEl.textContent = gameScore;
      soundPop();
      spawnBurst(e.clientX, e.clientY, 8, ['⭐', '✨']);
      spawnTarget();
    });

    clickerArea.appendChild(target);
    currentTarget = target;
  }

  btnStartClicker.addEventListener('click', function(){
    if(gameActive) return;
    gameActive = true;
    gameScore = 0;
    gameTimeLeft = 15;
    gameScoreEl.textContent = '0';
    gameTimerEl.textContent = '15';
    btnStartClicker.disabled = true;
    btnStartClicker.style.opacity = '0.5';
    clickerPrompt.style.display = 'none';

    soundFanfare();
    spawnTarget();

    gameInterval = setInterval(function(){
      gameTimeLeft--;
      gameTimerEl.textContent = gameTimeLeft;
      if(gameTimeLeft <= 0){
        clearInterval(gameInterval);
        endGame();
      }
    }, 1000);
  });

  function endGame(){
    gameActive = false;
    btnStartClicker.disabled = false;
    btnStartClicker.style.opacity = '1';
    if(currentTarget && currentTarget.parentNode){
      currentTarget.parentNode.removeChild(currentTarget);
    }
    clickerPrompt.style.display = 'block';
    clickerPrompt.innerHTML = 'Tempo scaduto! Punteggio: <strong>' + gameScore + '</strong> punti! 🎉';

    if(gameScore > gameHighscore){
      gameHighscore = gameScore;
      gameRecordEl.textContent = gameHighscore;
      showToast('🏆 NUOVO RECORD IN ACCHIAPPA IL NERO: ' + gameHighscore + ' punti!');
      soundFanfare();
    } else {
      showToast('Bravo! Hai totalizzato ' + gameScore + ' punti esotici!');
    }
    addXp(gameScore * 10, window.innerWidth / 2, window.innerHeight / 2);
  }


  /* ==========================================================================
     SALA GIOCHI: 4. SIMULATORE DI RIUNIONE AZIENDALE
     ========================================================================== */
  var meetingQuote = document.getElementById('meetingQuote');
  var btnNewMeeting = document.getElementById('btnNewMeeting');
  var btnCopyMeeting = document.getElementById('btnCopyMeeting');

  var meetingPhrases = [
    '"Dobbiamo schedulare una call per allinearci sul forecast."',
    '"Focalizziamoci sul core business per generare disruption nel mercato."',
    '"Facciamo un brainstorming ASAP per trovare una soluzione out of the box."',
    '"Qual è il commitment su questa task? Mi serve per il follow-up."',
    '"Dobbiamo fare onboarding sulle sinergie per scalare il business."',
    '"Mandami un brief così facciamo un check e ci portiamo avanti col delivery."',
    '"Il KPI è sfidante, serve un cambio di mindset per evitare il bottleneck."'
  ];
  var meetingIdx = 0;

  if (btnNewMeeting) {
      btnNewMeeting.addEventListener('click', function(e){
        soundPop();
        meetingIdx = (meetingIdx + 1) % meetingPhrases.length;
        meetingQuote.style.opacity = '0';
        setTimeout(function(){
          meetingQuote.textContent = meetingPhrases[meetingIdx];
          meetingQuote.style.opacity = '1';
        }, 150);
        var b = this.getBoundingClientRect();
        spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 6, ['👔', '💼', '📈']);
        addXp(15, e.clientX, e.clientY);
      });
  }

  if (btnCopyMeeting) {
      btnCopyMeeting.addEventListener('click', function(){
        soundPop();
        var text = meetingQuote.textContent.replace(/^"|"$/g, '');
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text);
          showToast('📋 Frase aziendale copiata! Usala nella prossima call.');
        } else {
          showToast('📋 Pronti a fare disruption!');
        }
      });
  }

/* ==========================================================================
     PROGETTI INTERATTIVI (SIMULAZIONI COMODE)
     ========================================================================== */
  var testProjBtns = document.querySelectorAll('.btn-test-proj');
  testProjBtns.forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      soundPop();
      var type = btn.getAttribute('data-proj');
      var fb = btn.nextElementSibling;
      var b = btn.getBoundingClientRect();

      if(type === 'niente'){
        fb.textContent = 'Esecuzione: 0 millisecondi. Risultato: assolutamente nulla.';
        spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 8, ['💨', '✨']);
        showToast('✅ "Niente" eseguito con impeccabile perfezione.');
      } else if(type === 'boh'){
        var bohFaces = ['¯\\_(ツ)_/¯', '┐(‘～` )┌', '¯\\(°_o)/¯'];
        var face = bohFaces[Math.floor(Math.random() * bohFaces.length)];
        fb.textContent = 'Boh AI risponde: ' + face;
        spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 8, ['🤖', '❓']);
        showToast('🤖 Boh ha ponderato l\'universo e se ne lava le mani.');
      } else if(type === 'forse'){
        var outcomes = ['Forse sì 🌤️', 'Forse no 🌧️', 'Forse martedì 🗓️', 'Chiedi al gatto 🐈'];
        var out = outcomes[Math.floor(Math.random() * outcomes.length)];
        fb.textContent = 'Esito Quantistico: ' + out;
        spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 8, ['🪙', '✨']);
        showToast('🔮 La sfortuna si è espressa!');
      }
    });
  });

  /* ==========================================================================
     CONTATTI & SOCIAL INTERATTIVI
     ========================================================================== */
  var mailLink = document.getElementById('mailLink');
  mailLink.addEventListener('click', function(e){
    e.preventDefault();
    soundPop();
    var email = 'francymaesotico@gmail.com';
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(email).then(function(){
        showToast('📩 Email (' + email + ') copiata! Ora puoi mandarmi dei meme.');
      }, function(){
        showToast('📩 Email: ' + email);
      });
    } else {
      showToast('📩 Email: ' + email);
    }
    var b = mailLink.getBoundingClientRect();
    spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 15, ['✉️', '🎉', '💖']);
  });

  var socialLinks = document.querySelectorAll('.social-link');
  socialLinks.forEach(function(link){
    link.addEventListener('click', function(e){
      e.preventDefault();
      soundPop();
      var msg = link.getAttribute('data-msg');
      showToast(msg);
      var b = link.getBoundingClientRect();
      spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 8, ['🚀', '✨']);
    });
  });

  /* ==========================================================================
     BANNER TARALLI (COOKIE IRONICO)
     ========================================================================== */
  var taralloBanner = document.getElementById('taralloBanner');
  var btnAcceptTarallo = document.getElementById('btnAcceptTarallo');
  var btnRejectTarallo = document.getElementById('btnRejectTarallo');
  var taralloDismissed = false;
  try{ if(localStorage.getItem('fra:tarallo')) taralloDismissed = true; }catch(e){}

  btnAcceptTarallo.addEventListener('click', function(e){
    taralloDismissed = true;
    try{ localStorage.setItem('fra:tarallo', '1'); }catch(e){}
    soundPop();
    var b = btnAcceptTarallo.getBoundingClientRect();
    spawnBurst(b.left + b.width / 2, b.top + b.height / 2, 20, ['🥯', '😋', '✨']);
    taralloBanner.classList.remove('visible');
    setTimeout(function(){ taralloBanner.style.display = 'none'; }, 450);
    showToast('🥯 Tarallo mangiato. Calorie assorbite: 0.');
    addXp(30, e.clientX, e.clientY);
  });

  btnRejectTarallo.addEventListener('click', function(){
    taralloDismissed = true;
    try{ localStorage.setItem('fra:tarallo', '1'); }catch(e){}
    soundPop();
    taralloBanner.classList.remove('visible');
    setTimeout(function(){ taralloBanner.style.display = 'none'; }, 450);
    showToast('🍏 Purtroppo rispetto la tua dieta.');
  });

  /* ==========================================================================
     EASTER EGG: CODICE KONAMI (↑ ↑ ↓ ↓ ← → ← → B A)
     ========================================================================== */
  var konamiSeq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var konamiIdx = 0;

  window.addEventListener('keydown', function(e){
    var key = e.key.toLowerCase();
    var targetKey = konamiSeq[konamiIdx].toLowerCase();

    if(key === targetKey){
      konamiIdx++;
      if(konamiIdx === konamiSeq.length){
        konamiIdx = 0;
        soundFanfare();
        spawnBurst(window.innerWidth / 2, window.innerHeight / 2, 60, ['🕶️', '🌴', '👑', '🎉', '🔥']);
        showToast('🕶️ CODICE SEGRETO ATTIVATO! LIVELLO ESOTICO: 9999!', 4000);
        unlock('konami');
        addXp(200, window.innerWidth / 2, window.innerHeight / 2);
      }
    } else {
      konamiIdx = 0;
    }
  });

  /* ==========================================================================
     OBIETTIVI (salvati nel browser, tornano quando ritorni sul sito)
     ========================================================================== */
  var ACH = [
    { id:'skill1',    icon:'👆', title:'Primo Click',               desc:'Clicca una delle skill.',                              xp:20 },
    { id:'skillsAll', icon:'🧺', title:'Collezionista di Difetti',  desc:'Clicca tutte le skill.',                               xp:60 },
    { id:'runaway',   icon:'🏃', title:'Riflessi da Disoccupato',   desc:'Fai arrendere il pulsante "Non scrivermi!".',          xp:60 },
    { id:'mail',      icon:'✉️', title:'Posta Esotica',             desc:'Clicca l\'email dopo averla fatta apparire.',          xp:40 },
    { id:'forbidden', icon:'☢️', title:'Pulsante Proibito',         desc:'Premi il pulsante proibito fino alla fine.',           xp:80 },
    { id:'oracle',    icon:'🔮', title:'Scusa Pronta',              desc:'Copia una scusa dall\'Oracolo.',                       xp:30 },
    { id:'projects',  icon:'🧪', title:'Beta Tester',               desc:'Prova tutti e tre i progetti.',                        xp:50 },
    { id:'who',       icon:'🎭', title:'Crisi d\'Identità',         desc:'Premi "Chi altro non sono?" 5 volte.',                 xp:40 },
    { id:'tarallo',   icon:'🥯', title:'Questione di Taralli',      desc:'Rispondi al banner dei taralli.',                      xp:30 },
    { id:'theme',     icon:'🌗', title:'Notte e Giorno',            desc:'Cambia il tema.',                                      xp:20 },
    { id:'bottom',    icon:'⬇️', title:'Fino in Fondo',             desc:'Scorri fino al fondo della pagina.',                   xp:30 },
    { id:'channels',  icon:'📺', title:'Stalker',                   desc:'Visita il canale YouTube o Twitch.',                   xp:40 },
    { id:'repo',      icon:'💻', title:'Curioso del Codice',        desc:'Apri uno dei repository dal mio GitHub.',              xp:40 },
    { id:'esotico',   icon:'🌟', title:'Sovraccarico Esotico',      desc:'Hai cliccato il badge ESOTICO.',                       xp:50, secret:true },
    { id:'francy',    icon:'🦩', title:'Narciso',                   desc:'Hai cliccato il mio nome gigante.',                    xp:40, secret:true },
    { id:'logo',      icon:'🌴', title:'Logo-dipendente',           desc:'Hai cliccato il logo in alto.',                        xp:40, secret:true },
    { id:'konami',    icon:'🕹️', title:'Nostalgico',                desc:'Hai inserito il codice segreto.',                      xp:100, secret:true },
    { id:'lost',      icon:'🧭', title:'Perso nel Nulla',           desc:'Hai trovato la pagina 404.',                           xp:60,  secret:true, hint:'a volte basta sbagliare strada.' },
    { id:'boss',      icon:'👑', title:'UNEMPLOYED FINAL BOSS',     desc:'Raggiungi il rango massimo.',                          xp:0 },
    { id:'platinum',  icon:'💎', title:'Disoccupato Completo',      desc:'Sblocca tutti gli altri obiettivi.',                   xp:300 }
  ];
  var achById = {};
  ACH.forEach(function(a){ achById[a.id] = a; });

  var achState = {};
  try{ achState = JSON.parse(localStorage.getItem('fra:ach') || '{}') || {}; }catch(e){ achState = {}; }
  function achSave(){ try{ localStorage.setItem('fra:ach', JSON.stringify(achState)); }catch(e){} }

  var achGrid = document.getElementById('achGrid');
  var achCountEl = document.getElementById('achCount');
  var achDetail = document.getElementById('achDetail');
  document.getElementById('achTotal').textContent = ACH.length;

  function achDetailText(def){
    var on = !!achState[def.id];
    if(on) return '🏆 <strong>' + def.title + '</strong> — ' + def.desc + (def.xp ? ' (+' + def.xp + ' XP)' : '');
    if(def.secret) return '🔒 <strong>???</strong> — Easter egg segreto: ' + (def.hint || 'continua a esplorare il sito.');
    return '🔒 <strong>' + def.title + '</strong> — ' + def.desc + (def.xp ? ' (+' + def.xp + ' XP)' : '');
  }

  function paintBadge(btn, def){
    var on = !!achState[def.id];
    btn.classList.toggle('on', on);
    btn.firstChild.textContent = (!on && def.secret) ? '❓' : def.icon;
    btn.setAttribute('aria-label', (on || !def.secret ? def.title : 'Obiettivo segreto') + ': ' + (on ? 'sbloccato' : 'bloccato'));
  }

  function updateAchCount(){
    var n = 0;
    ACH.forEach(function(a){ if(achState[a.id]) n++; });
    achCountEl.textContent = n;
  }

  ACH.forEach(function(def){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ach-badge';
    btn.setAttribute('data-ach', def.id);
    var ico = document.createElement('span');
    ico.className = 'ach-ico';
    btn.appendChild(ico);
    paintBadge(btn, def);
    var show = function(){ achDetail.innerHTML = achDetailText(def); };
    btn.addEventListener('mouseenter', show);
    btn.addEventListener('focus', show);
    btn.addEventListener('click', show);
    achGrid.appendChild(btn);
  });
  updateAchCount();

  function unlock(id, silent){
    var def = achById[id];
    if(!def || achState[id]) return;
    achState[id] = Date.now();
    achSave();

    var btn = achGrid.querySelector('[data-ach="' + id + '"]');
    if(btn){
      paintBadge(btn, def);
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }
    updateAchCount();
    if(silent) return;

    showToast('🏆 Obiettivo sbloccato: ' + def.title + (def.xp ? ' (+' + def.xp + ' XP)' : ''), 3400);
    soundFanfare();

    var x = window.innerWidth / 2, y = window.innerHeight * 0.6;
    if(btn){
      var r = btn.getBoundingClientRect();
      if(r.bottom > 0 && r.top < window.innerHeight){ x = r.left + r.width / 2; y = r.top + r.height / 2; }
    }
    spawnBurst(x, y, 14, ['🏆', '✨', def.icon]);

    if(def.xp) addXp(def.xp);

    // Meta-obiettivo: tutti gli altri
    var all = true;
    ACH.forEach(function(a){ if(a.id !== 'platinum' && !achState[a.id]) all = false; });
    if(all) unlock('platinum');
  }

  // Insiemi di cose già fatte (skill cliccate, progetti provati), salvati anch'essi
  var achSets = {};
  function trackSet(key, val, total, achId){
    if(!achSets[key]){
      try{ achSets[key] = JSON.parse(localStorage.getItem('fra:set:' + key) || '[]') || []; }catch(e){ achSets[key] = []; }
    }
    var arr = achSets[key];
    if(arr.indexOf(val) === -1){
      arr.push(val);
      try{ localStorage.setItem('fra:set:' + key, JSON.stringify(arr)); }catch(e){}
    }
    if(arr.length >= total) unlock(achId);
  }

  skillItems.forEach(function(item, idx){
    item.addEventListener('click', function(){ unlock('skill1'); trackSet('skills', idx, skillItems.length, 'skillsAll'); });
  });
  testProjBtns.forEach(function(btn){
    btn.addEventListener('click', function(){ trackSet('projs', btn.getAttribute('data-proj'), testProjBtns.length, 'projects'); });
  });
  var whoClicks = 0;
  btnOtherWho.addEventListener('click', function(){ if(++whoClicks >= 5) unlock('who'); });
  btnCopyExcuse.addEventListener('click', function(){ unlock('oracle'); });
  mailLink.addEventListener('click', function(){ unlock('mail'); });
  btnAcceptTarallo.addEventListener('click', function(){ unlock('tarallo'); });
  btnRejectTarallo.addEventListener('click', function(){ unlock('tarallo'); });
  document.getElementById('theme').addEventListener('click', function(){ unlock('theme'); });
  document.getElementById('badgeExotic').addEventListener('click', function(){ unlock('esotico'); });
  document.getElementById('logoBtn').addEventListener('click', function(){ unlock('logo'); });
  h1.addEventListener('click', function(){ unlock('francy'); });
  [].slice.call(document.querySelectorAll('.btn-youtube, .btn-twitch')).forEach(function(a){
    a.addEventListener('click', function(){ unlock('channels'); });
  });
  var repoGridEl = document.getElementById('repoGrid');
  if(repoGridEl){
    repoGridEl.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('.repo-card')) unlock('repo');
    });
  }
  var footEl = document.querySelector('footer');
  if(footEl && 'IntersectionObserver' in window){
    var footIo = new IntersectionObserver(function(en){
      if(en[0].isIntersecting){ unlock('bottom'); footIo.disconnect(); }
    }, {threshold: .6});
    footIo.observe(footEl);
  }

  achReady = true;
  // La pagina 404 lascia un segno nel browser: qui lo riscuoti
  try{ if(localStorage.getItem('fra:found404')) setTimeout(function(){ unlock('lost'); }, 700); }catch(e){}
  if(currentXp >= ranks[ranks.length - 1].threshold) unlock('boss', true);

  /* ---- TEMA CHIARO/SCURO ---- */
  document.getElementById('theme').addEventListener('click', function(){
    soundPop();
    var isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : !window.matchMedia('(prefers-color-scheme: light)').matches;
    root.dataset.theme = isDark ? 'light' : 'dark';
    try{ localStorage.setItem('fra:theme', root.dataset.theme); }catch(e){}
    showToast(isDark ? '☀️ Tema chiaro attivato' : '🌙 Tema scuro attivato');
  });

  /* ---- REVEAL ALLO SCROLL (CON RITARDI A CASCATA) ---- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  } else {
    document.querySelectorAll('.skills, .wrap, .games-grid').forEach(function(group){
      var n = 0;
      group.querySelectorAll(':scope > .reveal').forEach(function(el){
        el.style.setProperty('--d', (n++ * 0.08) + 's');
      });
    });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, {threshold:.15, rootMargin:'0px 0px -6% 0px'});
    revealEls.forEach(function(el){ io.observe(el); });
  }

  /* ---- ALONE CHE SEGUE IL MOUSE NELL'HERO ---- */
  var stageQueued = false, stX = 0, stY = 0;
  stage.addEventListener('pointermove', function(e){
    stX = e.clientX; stY = e.clientY;
    if (stageQueued) return;           // al massimo un aggiornamento per frame
    stageQueued = true;
    requestAnimationFrame(function(){
      stageQueued = false;
      var b = stage.getBoundingClientRect();
      stage.style.setProperty('--x', (stX - b.left) + 'px');
      stage.style.setProperty('--y', (stY - b.top) + 'px');
    });
  }, {passive:true});

  if (reduce) {
    window.addEventListener('scroll', function(){
      if (!taralloDismissed) {
        if (window.scrollY > 250) {
          taralloBanner.classList.add('visible');
        } else {
          taralloBanner.classList.remove('visible');
        }
      }
    }, {passive:true});
    return;
  }

  /* ---- INTRO ANIMATA ORIGINALE: SCRITTA GRANDE SU NERO CHE SI RIMPICCIOLISCE ---- */
  intro.classList.add('anim');

  var vw = 0, vh = 0, s0 = 1, dx = 0, dy = 0, range = 1;
  var usePointer = false, lastX = 0, lastY = 0;

  function measure(){
    h1.style.transform = 'none';
    var sb = stage.getBoundingClientRect();
    var hb = h1.getBoundingClientRect();
    var cx = hb.left - sb.left + hb.width / 2;
    var cy = hb.top  - sb.top  + hb.height / 2;
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    s0 = Math.max(1, Math.min(vw * 0.9 / hb.width, vh * 0.7 / hb.height));
    dx = vw / 2 - cx;
    dy = vh / 2 - cy;
    range = Math.max(1, intro.offsetHeight - stage.offsetHeight);
    update(true);
  }

  function setGlow(px, py){
    var r = h1.getBoundingClientRect();
    var sc = r.width / h1.offsetWidth || 1;
    h1.style.setProperty('--hx', ((px - r.left) / sc) + 'px');
    h1.style.setProperty('--hy', ((py - r.top)  / sc) + 'px');
  }

  var lastP = -1, driftOn = false, ticking = false, glowQueued = false;

  function update(force){
    var y = window.scrollY - intro.offsetTop;
    var p = clamp(y / range);
    if (!force && p === lastP) return;   // niente è cambiato: non ricalcolo nulla (fuori dall'intro succede quasi sempre)
    lastP = p;
    var e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
    var s = s0 + (1 - s0) * e;

    h1.style.transform = 'translate(' + (dx * (1 - e)) + 'px,' + (dy * (1 - e)) + 'px) scale(' + s + ')';
    stage.style.setProperty('--va', 1 - e);
    stage.style.setProperty('--oa', clamp(1 - e * 1.25));
    stage.style.setProperty('--ia', (clamp((e - .35) / .65) * 100) + '%');
    stage.style.setProperty('--c1', clamp((p - .55) / .3));
    stage.style.setProperty('--c2', clamp((p - .65) / .3));
    stage.style.setProperty('--c3', clamp((p - .75) / .25));
    stage.style.setProperty('--cu', clamp(1 - p * 6));
    stage.classList.toggle('ready', p > .75);

    var navA = clamp((p - .6) / .3);
    nav.style.setProperty('--na', navA);
    nav.classList.toggle('off', navA < .5);
    nav.classList.toggle('scrolled', p >= .9);

    /* Il messaggio dei cookie compare solo dopo essere usciti dalla schermata full-screen dell'intro */
    if (!taralloDismissed) {
      if (p >= 0.95) {
        taralloBanner.classList.add('visible');
      } else {
        taralloBanner.classList.remove('visible');
      }
    }

    if (usePointer && p < .7) setGlow(lastX, lastY);
    if (p < .7 && !usePointer) startDrift();
  }

  window.addEventListener('scroll', function(){
    if (ticking) return;               // al massimo un aggiornamento per frame
    ticking = true;
    requestAnimationFrame(function(){ ticking = false; update(); });
  }, {passive:true});
  window.addEventListener('resize', measure);

  window.addEventListener('pointermove', function(e){
    if (e.pointerType === 'touch') return;
    usePointer = true; lastX = e.clientX; lastY = e.clientY;
    if (glowQueued || lastP >= .7) return;   // a intro finita l'alone nelle lettere non si vede più
    glowQueued = true;
    requestAnimationFrame(function(){ glowQueued = false; setGlow(lastX, lastY); });
  }, {passive:true});

  // Senza mouse (touch) l'alone vaga da solo: gira solo mentre l'intro si vede, a ~30fps
  var lastDrift = 0;
  function drift(t){
    if (usePointer || lastP >= .7){ driftOn = false; return; }
    requestAnimationFrame(drift);
    if (document.hidden || t - lastDrift < 32) return;
    lastDrift = t;
    var r = h1.getBoundingClientRect();
    setGlow(r.left + r.width  * (.5 + .38 * Math.sin(t / 1900)),
            r.top  + r.height * (.5 + .30 * Math.sin(t / 1300 + 1)));
  }
  function startDrift(){
    if (!driftOn){ driftOn = true; requestAnimationFrame(drift); }
  }

  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  window.addEventListener('load', measure);
})();

/* Repository GitHub: letti in automatico dall'API pubblica, niente da aggiornare a mano. */
(function(){
  var USER = 'Fraaancy';
  var grid = document.getElementById('repoGrid');
  if (!grid) return;

  var CACHE_KEY = 'repos:' + USER, TTL = 10 * 60 * 1000;
  var LANG = {
    'Python':'#3572A5','JavaScript':'#f1e05a','TypeScript':'#3178c6','HTML':'#e34c26','CSS':'#563d7c',
    'C':'#808080','C++':'#f34b7d','C#':'#178600','Java':'#b07219','Go':'#00ADD8','Rust':'#dea584',
    'Shell':'#89e051','PowerShell':'#5391fe','Batchfile':'#C1F12E','Lua':'#6a7bff','PHP':'#4F5D95',
    'Ruby':'#701516','Kotlin':'#A97BFF','Swift':'#F05138','Dart':'#00B4AB','Jupyter Notebook':'#DA5B0B'
  };

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function ago(iso){
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d < 1)  return 'aggiornato oggi';
    if (d === 1) return 'aggiornato ieri';
    if (d < 30) return 'aggiornato ' + d + ' giorni fa';
    var m = Math.floor(d / 30);
    if (m < 12) return 'aggiornato ' + m + (m === 1 ? ' mese fa' : ' mesi fa');
    var y = Math.floor(d / 365);
    return 'aggiornato ' + y + (y === 1 ? ' anno fa' : ' anni fa');
  }

  function skeleton(){
    grid.textContent = '';
    for (var i = 0; i < 3; i++){
      var c = el('div', 'repo-card sk');
      c.appendChild(el('i')); c.appendChild(el('i')); c.appendChild(el('i'));
      grid.appendChild(c);
    }
  }

  function message(text, withLink){
    grid.textContent = '';
    var p = el('p', 'repo-msg', text + ' ');
    if (withLink){
      var a = el('a', null, 'Vai direttamente su GitHub');
      a.href = 'https://github.com/' + USER; a.target = '_blank'; a.rel = 'noopener noreferrer';
      p.appendChild(a);
    }
    grid.appendChild(p);
  }

  function card(r, i){
    var a = el('a', 'repo-card');
    a.href = r.html_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.style.setProperty('--i', i);

    var top = el('div', 'repo-top');
    top.appendChild(el('h3', 'repo-name', r.name));
    top.appendChild(el('span', 'repo-arrow', '↗'));
    a.appendChild(top);

    a.appendChild(el('p', 'repo-desc', r.description || 'Nessuna descrizione.'));

    var meta = el('div', 'repo-meta');
    if (r.language){
      var l = el('span');
      var dot = el('i', 'repo-dot'); dot.style.background = LANG[r.language] || 'var(--mute)';
      l.appendChild(dot); l.appendChild(document.createTextNode(r.language));
      meta.appendChild(l);
    }
    if (r.stargazers_count > 0) meta.appendChild(el('span', null, '★ ' + r.stargazers_count));
    if (r.forks_count > 0)      meta.appendChild(el('span', null, '⑂ ' + r.forks_count));
    meta.appendChild(el('span', null, ago(r.pushed_at || r.updated_at)));
    a.appendChild(meta);
    return a;
  }

  function render(repos){
    var own = repos.filter(function(r){
      var n = r.name.toLowerCase();
      return !r.fork && n !== (USER + '.github.io').toLowerCase() && n !== USER.toLowerCase();
    }).sort(function(a, b){
      return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
    });
    if (!own.length){ message('Ancora nessun repository pubblico.', true); return; }
    grid.textContent = '';
    own.forEach(function(r, i){ grid.appendChild(card(r, i)); });
  }

  function readCache(){
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch(e){ return null; }
  }
  function writeCache(d){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({t: Date.now(), d: d})); } catch(e){}
  }
  function getJSON(url){
    return fetch(url, {headers: {'Accept': 'application/vnd.github+json'}}).then(function(res){
      if (!res.ok){ var e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      return res.json();
    });
  }

  var cached = readCache();
  if (cached && Date.now() - cached.t < TTL){ render(cached.d); return; }

  skeleton();
  var firstErr = null;
  // 1) repos.json: file dello stesso sito, aggiornato in automatico da GitHub Actions
  //    (niente richieste esterne, quindi nessun blocco o limite)
  function loadLocal(){
    return fetch('repos.json', {cache: 'no-cache'}).then(function(res){
      if (!res.ok) throw new Error('repos.json ' + res.status);
      return res.json();
    }).then(function(d){
      if (!Array.isArray(d) || !d.length) throw new Error('repos.json vuoto');
      return d;
    });
  }

  // 2) altrimenti l'API pubblica di GitHub, 3) altrimenti la ricerca
  loadLocal()
    .catch(function(){
      return getJSON('https://api.github.com/users/' + USER + '/repos?per_page=100&sort=pushed&type=owner');
    })
    .catch(function(err){
      // Es. limite di richieste raggiunto: riprovo con la ricerca (limite separato)
      firstErr = err;
      return getJSON('https://api.github.com/search/repositories?q=user:' + USER + '&sort=updated&per_page=100')
        .then(function(d){
          if (!d.items || !d.items.length) throw err;
          return d.items;
        });
    })
    .then(function(data){ writeCache(data); render(data); })
    .catch(function(err){
      err = firstErr || err;
      console.warn('[repo GitHub]', err);
      if (cached && cached.d){ render(cached.d); return; }   // meglio dati un po' vecchi che niente
      var st = err && err.status;
      var text = (st === 403 || st === 429) ? 'GitHub sta limitando le richieste da questa connessione, riprova tra un po\u2019.'
               : st === 404 ? 'Utente GitHub non trovato.'
               : 'Non riesco a contattare GitHub in questo momento (blocco di rete o estensione?).';
      message(text + (st ? ' (errore ' + st + ')' : ''), true);
    });
})();
