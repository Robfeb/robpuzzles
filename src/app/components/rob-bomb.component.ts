import { Component, signal, computed, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

type CellType = 'fixed' | 'soft' | 'empty';
type ItemType = 'door' | 'bomb_up' | 'range_up' | 'speed_up';
type Phase = 'menu' | 'playing' | 'dead' | 'win';

interface GameCell { type: CellType; item?: ItemType; }
interface Bomb { id: number; x: number; y: number; timer: number; range: number; }
interface Enemy { id: number; x: number; y: number; alive: boolean; dir: number; moveIn: number; speed: number; }

const COLS = 15, ROWS = 13;
const DIRS = [[0,-1],[0,1],[-1,0],[1,0]];
const TICK = 100, BOMB_TIME = 3000, EXPL_TTL = 600;

@Component({
  selector: 'app-rob-bomb',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="rb-wrap">
  <div class="rb-hud">
    <span class="hud-item">💣 ×{{ maxBombs() }}</span>
    <span class="hud-item">🔥 ×{{ bombRange() }}</span>
    <span class="hud-item">👾 {{ aliveCount() }}</span>
    <span class="hud-level">
      @if (isImmortal()) { <span style="margin-right:8px" title="God Mode Active">✨</span> }
      Level {{ level() }}
    </span>
    <button class="icon-btn" (click)="startGame()" title="Restart">🔄</button>
  </div>

  <div class="rb-board" [style.width.px]="boardW()" [style.height.px]="boardH()">
    <div class="rb-grid"
         [style.gridTemplateColumns]="'repeat(15,'+cs()+'px)'"
         [style.gridTemplateRows]="'repeat(13,'+cs()+'px)'">
      @for (cell of flat(); track cell.k) {
        <div class="rb-cell"
             [class.fw]="cell.t==='fixed'"
             [class.sw]="cell.t==='soft'"
             [class.ex]="cell.ex">
          @if (cell.t==='soft') { <span class="c-soft">🧱</span> }
          @if (cell.t==='empty' && cell.item) { <span class="c-item">{{ iicon(cell.item) }}</span> }
          @if (cell.bomb!=null) { <span class="c-bomb">💣<sup>{{cell.bomb}}</sup></span> }
          @if (cell.enemy) { <span class="c-ent">👾</span> }
          @if (cell.player) { <span class="c-ent">🤖</span> }
        </div>
      }
    </div>

    @if (phase()==='menu') {
      <div class="rb-ov">
        <div class="rb-card">
          <h2>💣 Rob-Bomb</h2>
          <p>Destroy walls, kill enemies, find the 🚪 door!</p>
          <button class="primary" (click)="startGame()">Play!</button>
        </div>
      </div>
    }
    @if (phase()==='dead') {
      <div class="rb-ov dead-ov">
        <div class="rb-card">
          <h2>💥 Boom!</h2>
          <p>You were caught in the blast.</p>
          <button class="primary" (click)="startGame()">Try Again</button>
        </div>
      </div>
    }
    @if (phase()==='win') {
      <div class="rb-ov win-ov">
        <div class="rb-card">
          <h2>🎉 Level Clear!</h2>
          <button class="primary" (click)="nextLevel()">Next Level →</button>
        </div>
      </div>
    }
  </div>

  <div class="rb-ctrl">
    <div class="rb-dpad">
      <button class="db" (click)="move(0,-1)">▲</button>
      <div class="dr">
        <button class="db" (click)="move(-1,0)">◀</button>
        <button class="db bomb-fab" (click)="dropBomb()">💣</button>
        <button class="db" (click)="move(1,0)">▶</button>
      </div>
      <button class="db" (click)="move(0,1)">▼</button>
    </div>
  </div>
</div>
  `,
  styles: [`
:host{display:block;width:100%}
.rb-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px;background:var(--surface);border-radius:var(--radius-lg);border:1px solid var(--border);box-shadow:var(--shadow);max-width:720px;margin:0 auto}
.rb-hud{display:flex;align-items:center;gap:12px;width:100%;flex-wrap:wrap;font-weight:700;font-size:.9rem;color:var(--text)}
.hud-item{background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius-sm);padding:2px 8px}
.hud-level{margin-left:auto;color:var(--primary)}
.rb-board{position:relative;background:#111;border-radius:8px;overflow:hidden;border:3px solid #222}
.rb-grid{display:grid}
.rb-cell{display:flex;align-items:center;justify-content:center;position:relative;background:#1c1c2e;font-size:1.2em;line-height:1;border:1px solid #252540}
.rb-cell.fw{background:#0a0a14;border-color:#0a0a14}
.rb-cell.sw{background:#3a2a10;border-color:#4a3820}
.rb-cell.ex{background:#ff6600!important;animation:expl .1s ease infinite alternate}
@keyframes expl{to{background:#ffaa00!important}}
.c-soft,.c-item,.c-bomb,.c-ent{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;font-size:inherit}
.c-bomb sup{font-size:.5em;color:#fff;font-weight:700}
.rb-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);z-index:50}
.dead-ov{background:rgba(100,0,0,.8)}
.win-ov{background:rgba(0,60,0,.8)}
.rb-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;text-align:center;box-shadow:var(--shadow-lg);color:var(--text);max-width:260px}
.rb-card h2{margin:0 0 .5rem}
.rb-card p{margin:0 0 1rem;color:var(--text-secondary);font-size:.9rem}
.rb-ctrl{display:flex;justify-content:center;padding:4px 0}
.rb-dpad{display:flex;flex-direction:column;align-items:center;gap:4px}
.dr{display:flex;gap:4px;align-items:center}
.db{width:52px;height:52px;border-radius:8px;background:var(--surface-alt);border:1px solid var(--border);color:var(--text);font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,transform .08s}
.db:active{background:#0891b2;color:#fff;transform:scale(.93)}
.bomb-fab{background:radial-gradient(circle,#7f1d1d,#3b0000);border-color:#dc2626;color:#fff;font-size:1.6rem;width:60px;height:60px}
.bomb-fab:active{background:#dc2626}
  `]
})
export class RobBombComponent implements OnInit, OnDestroy {
  grid    = signal<GameCell[][]>([]);
  px      = signal(1);
  py      = signal(1);
  maxBombs   = signal(1);
  bombRange  = signal(2);
  bombs   = signal<Bomb[]>([]);
  enemies = signal<Enemy[]>([]);
  exMap   = signal<Map<string,number>>(new Map());
  phase   = signal<Phase>('menu');
  level   = signal(1);
  isImmortal = signal(false);
  private _iCount = 0;

  aliveCount = computed(() => this.enemies().filter(e => e.alive).length);

  cs = computed(() => {
    const w = Math.min(window.innerWidth - 32, 680);
    const h = window.innerHeight - 220;
    return Math.max(20, Math.min(Math.floor(w/COLS), Math.floor(h/ROWS)));
  });
  boardW = computed(() => this.cs() * COLS);
  boardH = computed(() => this.cs() * ROWS);

  flat = computed(() => {
    const g = this.grid(), px = this.px(), py = this.py();
    const bombs = this.bombs(), enemies = this.enemies(), ex = this.exMap();
    const out: any[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = g[y]?.[x] ?? { type: 'fixed' as CellType };
        const key = `${x},${y}`;
        const b = bombs.find(b => b.x===x && b.y===y);
        out.push({
          k: key, t: cell.type, item: cell.item,
          player: px===x && py===y,
          bomb: b ? Math.max(1, Math.ceil(b.timer/1000)) : null,
          enemy: enemies.some(e => e.alive && e.x===x && e.y===y),
          ex: ex.has(key),
        });
      }
    }
    return out;
  });

  iicon(item?: ItemType) {
    return item==='door'?'🚪':item==='bomb_up'?'💣':item==='range_up'?'🔥':'⚡';
  }

  private _bid = 0;
  private _eid = 0;
  private _loop: any;

  ngOnInit() {}
  ngOnDestroy() { clearInterval(this._loop); }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'i' || e.key === 'I') {
      this._iCount++;
      if (this._iCount >= 3 && !this.isImmortal()) {
        this.isImmortal.set(true);
        this.maxBombs.set(6);
        this.bombRange.set(8);
      }
    } else {
      this._iCount = 0;
    }

    if (this.phase()==='dead'||this.phase()==='win') {
      if (e.key==='Enter') { this.phase()==='win' ? this.nextLevel() : this.startGame(); }
      return;
    }
    if (this.phase()!=='playing') { if(e.key==='Enter'||e.key===' ') this.startGame(); return; }
    switch(e.key) {
      case 'ArrowUp':    case 'w': case 'W': this.move(0,-1); e.preventDefault(); break;
      case 'ArrowDown':  case 's': case 'S': this.move(0, 1); e.preventDefault(); break;
      case 'ArrowLeft':  case 'a': case 'A': this.move(-1,0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': this.move(1, 0); e.preventDefault(); break;
      case ' ': case 'f': case 'F': this.dropBomb(); e.preventDefault(); break;
    }
  }

  startGame() {
    clearInterval(this._loop);
    this.isImmortal.set(false);
    this._iCount = 0;
    this.level.set(1); this.maxBombs.set(1); this.bombRange.set(2);
    this.px.set(1); this.py.set(1);
    this.bombs.set([]); this.exMap.set(new Map());
    this._bid = 0; this._eid = 0;
    this.grid.set(this.buildGrid());
    this.enemies.set(this.spawnEnemies());
    this.phase.set('playing');
    this._loop = setInterval(() => this.tick(), TICK);
  }

  nextLevel() {
    clearInterval(this._loop);
    this.level.update(l => l+1);
    if (this.level() % 3 === 0) this.maxBombs.update(n => Math.min(n+1,8));
    this.px.set(1); this.py.set(1);
    this.bombs.set([]); this.exMap.set(new Map());
    this.grid.set(this.buildGrid());
    this.enemies.set(this.spawnEnemies());
    this.phase.set('playing');
    this._loop = setInterval(() => this.tick(), TICK);
  }

  move(dx: number, dy: number) {
    if (this.phase()!=='playing') return;
    const nx = this.px()+dx, ny = this.py()+dy;
    if (nx<0||ny<0||nx>=COLS||ny>=ROWS) return;
    const cell = this.grid()[ny][nx];
    if (!this.isImmortal() && cell.type!=='empty') return;
    if (!this.isImmortal() && this.bombs().some(b=>b.x===nx&&b.y===ny)) return;
    this.px.set(nx); this.py.set(ny);
    if (cell.item && cell.item!=='door') { this.collectItem(cell.item, nx, ny); return; }
    if (cell.item==='door' && this.aliveCount()===0) { this.phase.set('win'); clearInterval(this._loop); return; }
    if (!this.isImmortal() && this.enemies().some(e=>e.alive&&e.x===nx&&e.y===ny)) { this.die(); }
  }

  dropBomb() {
    if (this.phase()!=='playing') return;
    const x=this.px(), y=this.py();
    if (this.bombs().length>=this.maxBombs()) return;
    if (this.bombs().some(b=>b.x===x&&b.y===y)) return;
    const timer = this.isImmortal() ? 0 : BOMB_TIME;
    this.bombs.update(bs=>[...bs,{id:++this._bid,x,y,timer,range:this.bombRange()}]);
  }

  private tick() {
    if (this.phase()!=='playing') return;
    const expired: Bomb[] = [];
    this.bombs.update(bs => {
      const next: Bomb[] = [];
      for (const b of bs) {
        const u = {...b, timer: b.timer-TICK};
        if (u.timer<=0) expired.push(b); else next.push(u);
      }
      return next;
    });
    for (const b of expired) this.explode(b);

    this.exMap.update(m => {
      const n = new Map<string,number>();
      m.forEach((ttl,k)=>{ if(ttl-TICK>0) n.set(k, ttl-TICK); });
      return n;
    });

    const pk = `${this.px()},${this.py()}`;
    if (!this.isImmortal() && this.exMap().has(pk)) { this.die(); return; }

    this.enemies.update(es => es.map(e => {
      if (!e.alive) return e;
      const u = {...e, moveIn: e.moveIn-TICK};
      if (u.moveIn<=0) { u.moveIn=e.speed; return this.stepEnemy(u); }
      return u;
    }));

    if (!this.isImmortal() && this.enemies().some(e=>e.alive&&e.x===this.px()&&e.y===this.py())) this.die();
  }

  private explode(bomb: Bomb) {
    const blastKeys = new Set<string>();
    blastKeys.add(`${bomb.x},${bomb.y}`);
    const toDestroy: {x:number,y:number}[] = [];
    const chainIds: number[] = [];

    for (const [dx,dy] of DIRS) {
      let softsHit = 0;
      for (let r=1; r<=bomb.range; r++) {
        const x=bomb.x+dx*r, y=bomb.y+dy*r;
        if (x<0||y<0||x>=COLS||y>=ROWS) break;
        const cell = this.grid()[y][x];
        if (cell.type==='fixed') break;
        blastKeys.add(`${x},${y}`);
        if (cell.type==='soft') { 
          toDestroy.push({x,y}); 
          if (this.isImmortal()) {
            softsHit++;
            if (softsHit >= 3) break;
          } else {
            break; 
          }
        }
        const cb = this.bombs().find(b=>b.x===x&&b.y===y);
        if (cb) { chainIds.push(cb.id); break; }
      }
    }

    if (toDestroy.length) {
      this.grid.update(g => {
        const n = g.map(r=>[...r]);
        for (const {x,y} of toDestroy) n[y][x] = {...n[y][x], type:'empty'};
        return n;
      });
    }

    this.exMap.update(m => {
      const n = new Map(m);
      blastKeys.forEach(k=>n.set(k,EXPL_TTL));
      return n;
    });

    this.enemies.update(es => es.map(e => {
      if (!e.alive||!blastKeys.has(`${e.x},${e.y}`)) return e;
      return {...e, alive:false};
    }));

    if (chainIds.length) {
      const chains: Bomb[] = [];
      this.bombs.update(bs => { chains.push(...bs.filter(b=>chainIds.includes(b.id))); return bs.filter(b=>!chainIds.includes(b.id)); });
      chains.forEach(b=>this.explode(b));
    }
  }

  private stepEnemy(e: Enemy): Enemy {
    const dirs = [0,1,2,3];
    for (let i=dirs.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [dirs[i],dirs[j]]=[dirs[j],dirs[i]]; }
    const order = [e.dir, ...dirs.filter(d=>d!==e.dir)];
    for (const dir of order) {
      const [dx,dy]=DIRS[dir];
      const nx=e.x+dx, ny=e.y+dy;
      if (nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
      const cell=this.grid()[ny][nx];
      if (cell.type!=='empty') continue;
      if (this.bombs().some(b=>b.x===nx&&b.y===ny)) continue;
      return {...e,x:nx,y:ny,dir};
    }
    return e;
  }

  private collectItem(item: ItemType, x: number, y: number) {
    if (item==='bomb_up') this.maxBombs.update(n=>Math.min(n+1,8));
    if (item==='range_up') this.bombRange.update(n=>Math.min(n+1,8));
    if (item==='speed_up') this.bombRange.update(n=>Math.min(n+1,8));
    this.grid.update(g=>{ const n=g.map(r=>[...r]); n[y][x]={type:'empty'}; return n; });
  }

  private die() {
    this.phase.set('dead');
    clearInterval(this._loop);
  }

  private buildGrid(): GameCell[][] {
    const g: GameCell[][] = Array.from({length:ROWS},(_,y)=>
      Array.from({length:COLS},(_,x)=>{
        if(x===0||y===0||x===COLS-1||y===ROWS-1) return {type:'fixed'};
        if(x%2===0&&y%2===0) return {type:'fixed'};
        if((x<=2&&y<=2)||(x<=2&&y>=ROWS-3)||(x>=COLS-3&&y<=2)) return {type:'empty'};
        return {type:(Math.random()<0.65?'soft':'empty')} as GameCell;
      })
    );

    // Collect soft cells for item placement
    const softs:[number,number][]=[];
    for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++) if(g[y][x].type==='soft') softs.push([x,y]);
    for(let i=softs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[softs[i],softs[j]]=[softs[j],softs[i]];}

    const items: ItemType[] = ['door','bomb_up','range_up','speed_up','bomb_up','range_up','range_up','bomb_up','speed_up','range_up','bomb_up'];
    for(let i=0;i<Math.min(items.length,softs.length);i++){
      const[x,y]=softs[i]; g[y][x].item=items[i];
    }
    return g;
  }

  private spawnEnemies(): Enemy[] {
    const count = Math.min(2+this.level(), 6);
    const speed = Math.max(350, 900 - (this.level()-1)*80);
    const starts = [[COLS-2,ROWS-2],[COLS-2,1],[7,ROWS-2],[7,6],[COLS-4,ROWS-4],[3,ROWS-2]];
    return starts.slice(0,count).map(([x,y])=>({
      id:++this._eid, x, y, alive:true,
      dir:Math.floor(Math.random()*4),
      moveIn: speed+Math.random()*200,
      speed,
    }));
  }
}
