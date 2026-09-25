# Firehouse v0.3.0 — Implementation Review, QA & Compliance Test Plan

## Scope and authoritative current rules

This document reviews the actual Firehouse implementation after the v0.3.0 completion/polish pass.

Current authoritative mechanics:
- 7×7 board (49 symbols).
- Wins require 8+ matching paying symbols connected orthogonally. Wild substitutes; Wild-only groups do not pay.
- Cascades remove all winning cells, surviving symbols fall vertically, and replacements enter from the top.
- Fire is symbol-based. Burning/Smouldering metadata moves with a surviving symbol and disappears when that symbol is removed.
- New ignition starts Burning 2×.
- A spread opportunity rolls once for the event. When spread succeeds, every Burning symbol present at event start spreads to every eligible orthogonal non-Burning neighbor. Newly ignited symbols wait for the next spread opportunity.
- Normal spread into Smouldering reignites at the existing value without doubling.
- Spray selects one horizontal row and water affects that row plus every row beneath it. Burning symbols hit by water become Smouldering and double.
- Backdraft is checked only immediately after Spray. It requires at least one surviving Burning symbol touching at least one Smouldering symbol. When triggered, all Smouldering symbols double and become Burning, then a normal spread opportunity may follow.
- Fire multipliers inside a winning cluster are additive.
- 3-Alarm: 5 free spins; Fire may ignite/spread; no between-spin persistence.
- 4-Alarm: 7 free spins; each round starts fire; Spray ends each round; no between-spin persistence.
- 5-Alarm: 10 free spins; full fire system plus Fire Wild persistence.
- At the end of each 5-Alarm spin, all surviving Burning and Smouldering multiplier values are SUMMED with no Fire-Wild symbol-X cap. They visually compress into one Fire Wild near center, then bank to the bottom of that same column for the transition.
- The following 5-Alarm spin generates a fresh board, places the stored Fire Wild on a new eligible host position, and creates at least one separate fresh Burning 2× symbol.
- The Fire Wild is a real Wild. It can spread when Burning, be sprayed, Smoulder, Backdraft, participate in additive win math, cascade, and be removed normally.
- Current configured target RTP is nominally 96% for the baseline profile. The browser simulation is explicitly base-game-only; full-game theoretical RTP has NOT been recalibrated/certified after the Fire/bonus changes.
- Rare base-game fire teaser events are selected before board generation and use a higher-volatility generation profile; they do not inspect a completed payout and force extra value afterward.
- Big-win tiers are configurable presentation thresholds and do not alter the resolved payout.
- No new external art/audio assets were added in this pass. Procedural CSS/DOM effects and event hooks are used.

## What changed in v0.3.0

1. Added generalized game/event history with spin IDs and optional console logging.
2. Added presentation speed scaling: 0.25×, 0.5×, 1×, 2× and turbo.
3. Separated Spray/Smouldering resolution from Backdraft execution so Backdraft can have a true anticipation beat without animation timing deciding eligibility.
4. Added procedural ember, spark, smoke, mist, water and Backdraft-burst effects with hard DOM caps and cleanup.
5. Added readable Burning/Smouldering visual states while keeping underlying symbols identifiable.
6. Added bonus transition overlays and tiered BIG / SUPER / MEGA / INFERNO win presentations.
7. Added rare base-game Fire teaser selection before board generation.
8. Added seeded debug RNG, direct 3/4/5-Alarm entry, development Bonus Buy harness, all-row Spray tests, positive/negative Backdraft scenarios, Fire Wild scenarios, high-multiplier tests, compression tests and maximum-intensity tests.
9. Added developer math profiles that alter actual payout/probability inputs, symbol-weight controls, tier-trigger stress rates and active configuration display.
10. Added live state inspector, bounded event log and core engine self-tests.
11. Added runtime animation/error cleanup so a client presentation exception does not permanently lock the controls.
12. Kept current user-directed Fire Wild math: straight survivor sum with no symbol-X cap.

## Critical items still incomplete / not production ready

### Production blockers
- There is no server-authoritative outcome service, wallet, transaction ledger, result ID, reconnect protocol, idempotent replay protection or authoritative state restoration. Browser refresh currently cannot satisfy regulated disconnect requirements.
- Full-game theoretical RTP, volatility, hit frequency, bonus contribution, tail distribution and maximum exposure are not currently established after the Fire system and rare base-fire features. The old browser sampler is insufficient.
- Client-side crypto RNG is suitable for prototype randomness testing but is not a complete regulated production RNG architecture by itself.
- Debug code is intentionally present in this development build. A production build must set the debug build flag off and ideally tree-shake/remove debug paths entirely.
- Bonus Buy pricing is not designed. The current harness accepts explicit development-only inputs and must not be treated as an approved purchase economy.
- No formal maximum-win rule is currently implemented. The uncapped Fire Wild can grow very large; exposure/overflow and game-liability analysis are required.

### Important engineering gaps
- Runtime error recovery unlocks the UI, but without a server authority it cannot determine whether an interrupted financial result should be restored, replayed or settled. Do not treat the client recovery path as transaction recovery.
- The full game remains mostly one JavaScript module. State, math, presentation and developer tooling are more separated than before but should be split into dedicated modules before certification.
- Audio infrastructure is not present. v0.3.0 emits firehouse:event and firehouse:audio CustomEvents so production audio can subscribe without coupling audio to math.
- Procedural fire/water/smoke effects are suitable for mechanics testing, but final production art/VFX may still be desirable.
- Automated browser regression infrastructure is not yet committed; current built-in self-tests are focused engine checks, not a replacement for Playwright/device testing.

## Math simulation requirements

Do not certify RTP from a fixed 20,000-spin browser run. Build a presentation-free simulation that exercises the SAME outcome engine, including:
- natural base cascades;
- rare base Fire feature selection;
- 3/4/5 Alarm trigger frequencies;
- every free-spin mechanic;
- Fire Spread;
- Spray;
- Smouldering;
- Backdraft;
- Fire Wild creation/removal/carryover;
- additive multiplier wins.

For every math profile report at minimum:
- total RTP;
- base-game RTP contribution;
- 3-Alarm contribution;
- 4-Alarm contribution;
- 5-Alarm contribution;
- hit frequency;
- bonus frequency by tier;
- average bonus payout by tier;
- standard deviation / variance;
- percentile payout distribution;
- max observed win and Fire Wild;
- sample size;
- 95% confidence interval for RTP.

Use a sequential stopping rule based on sample variance rather than claiming that one fixed spin count is universally sufficient. As a practical starting point, use at least 10 million full-game spins for development comparison, and expect high-volatility/tail analysis to require 100 million+ or targeted rare-event methods. Certification requirements and lab methodology control the final standard.

## State / disconnect architecture requirement

Before any real-money submission, each paid spin needs an authoritative server-side transaction/result identity. Outcome generation must be committed independently of presentation. Reconnect must restore the exact committed result and current feature state without rerolling. Fire Wild state, current free-spin index, remaining free spins, Spray row, Backdraft result and accumulated win must all be reconstructable or derivable from that authoritative result.

## Test case matrix

| Test ID | Category | Feature | Preconditions | Steps | Expected Result | Math/State Validation | Animation Validation | Severity | Regression Priority | Pass/Fail |
|---|---|---|---|---|---|---|---|---|---|---|
| MATH-001 | RNG & Math | Paytable bands | Baseline profile; fixed bet | Create exact 8/9, 10/11, 12/14, 15/19, 20/24, 25+ clusters for each regular symbol. | Award equals implemented band × active payout scale. | Validate baseAmountX and totalX before presentation. | Highlight/removal does not change amount. | Critical | P0 |  |
| MATH-002 | RNG & Math | Orthogonal connectivity | Known board with diagonal-only matches | Evaluate board. | Diagonal contacts do not connect; only up/down/left/right count. | Cluster membership exact. | No false win animation. | Critical | P0 |  |
| MATH-003 | RNG & Math | Wild substitution | Regular + Wild cluster; Wild-only cluster | Evaluate both. | Wild joins paying symbols; Wild-only group does not pay. | Positions/remove set exact. | Wild visual does not imply standalone pay. | Critical | P0 |  |
| MATH-004 | RNG & Math | Simultaneous wins | Board containing 2+ disjoint wins | Evaluate once. | All valid clusters pay and remove together. | Sum individual amountX exactly once. | All winning cells highlight together. | Critical | P0 |  |
| MATH-005 | RNG & Math | Cascade accumulation | Seeded multi-cascade board | Resolve until no win. | Total is sum of every cascade once. | No duplicate cascade award. | Drop order matches state. | Critical | P0 |  |
| MATH-006 | RNG & Math | Fire additive multiplier | Winning cluster contains fire 2x, 4x, 8x | Evaluate win. | Fire multiplier is 14x, never 64x. | fireMultiplier=14; award=base×14. | Displayed fire detail matches. | Critical | P0 |  |
| MATH-007 | RNG & Math | No-fire multiplier | Normal winning cluster | Evaluate win. | Normal cluster uses effective 1x multiplier. | No accidental zero payout. | Normal win visual only. | Critical | P0 |  |
| MATH-008 | RNG & Math | Burning initial value | Ignite Normal symbol | Inspect state. | New ignition becomes Burning 2x. | Exact state/multiplier. | 2x appears after combustion. | High | P0 |  |
| MATH-009 | RNG & Math | Multi-source spread | 3 separated Burning sources | Force spread event. | Every source spreads simultaneously to every eligible orthogonal neighbor. | sourcesSpread includes all eligible sources; targets unique. | All combustion cues resolve. | Critical | P0 |  |
| MATH-010 | RNG & Math | Spread event probability | Seeded repeated spread opportunities | Run large sample. | Chance is rolled once per spread event, not once per source. | Observed event rate tracks configured profile. | Animation only when event succeeds. | Critical | P0 |  |
| MATH-011 | RNG & Math | Smoulder reignition | Smouldering 16x adjacent to spreading fire | Force spread. | Becomes Burning 16x, not 32x. | No multiplier change. | Reignite cue distinct from new 2x ignition. | Critical | P0 |  |
| MATH-012 | RNG & Math | Spray doubling | Burning 2x/8x in affected rows | Spray selected row. | Each becomes Smouldering 4x/16x. | Exactly ×2 once. | Multiplier transition visible. | Critical | P0 |  |
| MATH-013 | RNG & Math | Water coverage | Burning above, on, and below Spray row | Resolve Spray. | Selected row and all rows below affected; rows above untouched. | AffectedRows exact. | Hose then downward drip explains coverage. | Critical | P0 |  |
| MATH-014 | RNG & Math | Backdraft eligibility | Surviving Burning touches Smouldering after Spray | Resolve Spray. | Backdraft eligible only after Spray. | Eligibility true before mutation. | Pressure-build cue occurs. | Critical | P0 |  |
| MATH-015 | RNG & Math | Backdraft negative | All fire extinguished or no touching pair | Resolve Spray. | No Backdraft. | Eligibility false; no multiplier second double. | No explosion cue. | Critical | P0 |  |
| MATH-016 | RNG & Math | Backdraft doubling | Smouldering 8x + valid surviving Burning | Resolve Backdraft. | All Smouldering become Burning 16x. | Every current Smouldering doubles once. | Explosion and multiplier pop align. | Critical | P0 |  |
| MATH-017 | RNG & Math | Fire Wild compression sum | Survivors 2x,4x,8x,16x | End 5-Alarm spin. | Carryover Fire Wild = 30x. | Straight sum, no cap. | Merge visually shows consolidation. | Critical | P0 |  |
| MATH-018 | RNG & Math | Uncapped Fire Wild | Survivors total >128x | Compress. | Exact sum preserved with no symbol-X cap. | No Math.min/carryover cap. | Large value remains readable. | Critical | P0 |  |
| MATH-019 | RNG & Math | Fire Wild removal | Fire Wild included in paying cluster | Resolve cascade. | Wild and stored multiplier are removed normally. | No hidden carryover immunity. | Removal animation normal. | Critical | P0 |  |
| MATH-020 | RNG & Math | Wager scaling | Same seeded outcome at multiple bets | Run outcome with different bet amounts. | X result identical; currency win scales linearly with bet. | creditsWon=totalX×bet. | Presentation reports X independent of denomination. | Critical | P0 |  |
| MATH-021 | RNG & Math | Rounding | Fractional pay outcomes across long cascades | Evaluate/account. | No premature rounding; display formatting only. | Internal sums retain numeric precision. | Displayed values consistently rounded. | High | P1 |  |
| MATH-022 | RNG & Math | Bonus trigger count | Final base board has 2/3/4/5+ alarms | Resolve trigger. | 2=no bonus; 3=3-Alarm; 4=4-Alarm; 5+=5-Alarm. | Tier mapping exact. | Anticipation never changes count. | Critical | P0 |  |
| MATH-023 | RNG & Math | Free-spin totals | Direct/forced 3,4,5 Alarm | Run bonus. | Exactly 5/7/10 free spins respectively. | Counters decrement once per spin. | Counter visuals match state. | Critical | P0 |  |
| MATH-024 | RNG & Math | 5-Alarm fresh ignition | Carryover Wild Burning and Smouldering cases | Start next free spin. | At least configured fresh ignition elsewhere starts Burning 2x. | Fresh target differs from carryover Wild when possible. | Entry then ignition sequence clear. | High | P0 |  |
| MATH-025 | RNG & Math | Fire Wild state | Mixed survivor states vs all Smouldering | Compress. | Any Burning => Burning Wild; all Smouldering => Smouldering Wild. | State exact. | Visual state unambiguous. | Critical | P0 |  |
| MATH-026 | RNG & Math | Math profile effect | Baseline vs stress profiles with same seed | Run samples. | Profiles alter actual payout/probability inputs, not display only. | Config snapshot proves changed parameters. | No presentation-only RTP fake. | High | P1 |  |
| MATH-027 | RNG & Math | Seed reproducibility | Set debug seed; reset seed state | Run identical test twice. | Same RNG sequence and board outcomes. | Seed state deterministic. | Animations may differ only visually. | High | P1 |  |
| MATH-028 | RNG & Math | Base fire preselection | Normal game with rare teaser selected | Trace event order. | Feature class selected before board generation; no payout chasing. | Event history shows feature before result evaluation. | Teaser is visualized after board lands. | Critical | P0 |  |
| MATH-029 | RNG & Math | Base-only simulation labeling | Run browser 20k simulation | Inspect result. | Clearly identified as base-only sample, not full-game RTP. | No bonus/fire contribution included. | N/A | High | P0 |  |
| MATH-030 | RNG & Math | Full-game RTP Monte Carlo | Presentation-free full model required | Run large simulation by profile. | Mean RTP converges with CI reported; bonus contribution separated. | Use sample variance and 95% CI; run until target half-width achieved. | No animation code involved. | Critical | P0 |  |
| STATE-001 | State & Recovery | Close during base spin | Authoritative server version required | Terminate after wager accepted, before result display; reconnect. | Same committed result restores; no duplicate/lost wager. | Transaction/result ID idempotent. | Presentation resumes or settles safely. | Critical | P0 |  |
| STATE-002 | State & Recovery | Close during cascade | Committed result with cascade chain | Terminate after cascade 1; reconnect. | Remaining deterministic cascade chain restores. | No reroll; accumulated win preserved. | Resume from authoritative state. | Critical | P0 |  |
| STATE-003 | State & Recovery | Close at bonus trigger | Alarm trigger committed | Terminate during transition. | Bonus entitlement persists exactly once. | Free spins not duplicated/lost. | Transition may replay without changing state. | Critical | P0 |  |
| STATE-004 | State & Recovery | Close during free spins | Mid 3/4/5 Alarm | Terminate and reconnect. | Exact free-spin index/state restores. | No extra free spin. | Resume UI counter accurately. | Critical | P0 |  |
| STATE-005 | State & Recovery | Close during Spray | Spray outcome committed | Terminate during hose/drip. | Spray row and resulting fire state restore. | No reroll of row or duplicate doubling. | Animation can replay safely. | Critical | P0 |  |
| STATE-006 | State & Recovery | Close during Backdraft | Eligibility/result committed | Terminate during anticipation. | Same Backdraft result restores once. | No duplicate multiplier doubling. | Anticipation replay cannot mutate again. | Critical | P0 |  |
| STATE-007 | State & Recovery | Close during compression | 5-Alarm survivors resolved | Terminate mid-merge. | Same summed Fire Wild restores. | No survivor double-collection. | Compression may replay from snapshot. | Critical | P0 |  |
| STATE-008 | State & Recovery | Close between 5-Alarm spins | Fire Wild banked | Terminate before next board. | Carryover Wild exact state/multiplier persists. | Next board uses committed RNG state/result. | Banked visual restores accurately. | Critical | P0 |  |
| STATE-009 | State & Recovery | Duplicate response/replay | Replay same result payload | Process duplicate. | Balance/win applied once. | Idempotency key rejects repeat. | No duplicate celebration causing accounting. | Critical | P0 |  |
| STATE-010 | State & Recovery | Client runtime error | Force animation exception | Run spin. | UI unlocks and error is logged; prototype does not silently invent payout. | No second spin while uncertain result exists in production design. | Visual effects cancelled. | High | P0 |  |
| STATE-011 | State & Recovery | Stale fire state | Finish bonus then base spin | Inspect state. | No Burning/Smouldering/Fire Wild leaks into new base spin. | Arrays reset exactly. | No stale glow/badge. | Critical | P0 |  |
| STATE-012 | State & Recovery | Free-spin counter boundary | Last bonus spin with cascades/events | Resolve to completion. | Counter reaches 0 once after all final events. | No negative or duplicate decrement. | Completion transition after events. | High | P0 |  |
| INT-001 | Feature Intersection | Spread then win | Burning spreads into future winning cluster | Resolve. | New fire state contributes if symbol remains in win. | Additive multiplier calculated from final pre-win state. | Combustion completes before win highlight. | Critical | P0 |  |
| INT-002 | Feature Intersection | Win removes Burning | Burning symbol in cluster | Resolve cascade. | Fire state disappears with removed symbol. | No residue at old coordinate. | Pop removes both symbol/fire cue. | Critical | P0 |  |
| INT-003 | Feature Intersection | Win removes Smouldering | Smouldering symbol in cluster | Resolve cascade. | Stored multiplier is lost. | No carryover contribution afterward. | Dormant state disappears cleanly. | Critical | P0 |  |
| INT-004 | Feature Intersection | Fire moves in cascade | Burning survivor above removed cells | Cascade. | Symbol and fire metadata move together. | Destination fire state matches source. | Glow/badge lands with symbol. | Critical | P0 |  |
| INT-005 | Feature Intersection | New cascade symbol | Spawn replacement into former fire position | Cascade. | New symbol starts Normal 0x. | No coordinate-based fire persistence. | No inherited glow. | Critical | P0 |  |
| INT-006 | Feature Intersection | Spray + Fire Wild | Burning Fire Wild in water zone | Spray. | Wild becomes Smouldering and doubles. | Same rules as any fire symbol. | Wild sprite remains identifiable. | Critical | P0 |  |
| INT-007 | Feature Intersection | Backdraft + Fire Wild | Smouldering Fire Wild plus valid Burning neighbor | Trigger Backdraft. | Wild doubles and becomes Burning. | No special-case math. | Explosion affects Wild visibly. | Critical | P0 |  |
| INT-008 | Feature Intersection | Smouldering Wild win | Smouldering Wild connects cluster | Evaluate win. | Wild substitutes and multiplier contributes additively. | Win amount exact. | Dormant Wild readable during win. | Critical | P0 |  |
| INT-009 | Feature Intersection | Fire Wild + fire symbols win | 12x Wild + 4x +2x in same cluster | Evaluate. | Fire total=18x. | Never multiplicative. | Win detail shows 18x. | Critical | P0 |  |
| INT-010 | Feature Intersection | Fire Wild survives compression | Existing Wild plus other survivors | End spin. | Existing Wild value participates in total sum if still present. | Count each survivor exactly once. | All converge to one Wild. | Critical | P0 |  |
| INT-011 | Feature Intersection | Fire Wild destroyed, others survive | Remove Wild during cascade; other fire remains | End spin. | New Wild is created only from remaining survivors. | Destroyed Wild value absent. | Compression total reflects survivors only. | Critical | P0 |  |
| INT-012 | Feature Intersection | Complete extinguish | All Burning contacted by water | Resolve. | All become Smouldering; no Backdraft without surviving Burning. | No false eligibility. | Quiet end; no burst. | Critical | P0 |  |
| INT-013 | Feature Intersection | Partial extinguish | Some Burning above Spray row | Resolve. | Affected fire smoulders; above remains Burning. | Backdraft based on actual adjacency. | Readable split states. | Critical | P0 |  |
| INT-014 | Feature Intersection | Backdraft then spread | Valid Backdraft | Resolve full event. | Backdraft resolves, then one normal spread opportunity. | Backdraft not retriggered from ordinary spread. | Burst then spread pacing. | Critical | P0 |  |
| INT-015 | Feature Intersection | 3-Alarm fire reset | End one 3-Alarm spin with fire survivors | Start next spin. | No between-spin persistence. | Fresh board/no stored fire. | Transition clears prior effects. | High | P0 |  |
| INT-016 | Feature Intersection | 4-Alarm round isolation | End 4-Alarm spin | Next spin. | Prior fire does not persist; new round ignition occurs. | Each spin self-contained. | Emergency cadence readable. | High | P0 |  |
| INT-017 | Feature Intersection | 5-Alarm carryover entry | Banked Wild exists | Start next spin. | Fresh board first; one real Wild receives exact stored state/value. | No old host symbol persists. | Wild entry animation then ignition. | Critical | P0 |  |
| INT-018 | Feature Intersection | 5-Alarm bank position | Compression target in any column | Complete compression. | Forged Wild drops to bottom of same column for transition. | bankedIndex column == targetIndex column. | Heavy drop/bounce no snap-back. | Medium | P1 |  |
| INT-019 | Feature Intersection | Final free-spin events | Last free spin triggers cascades/Spray/Backdraft | Resolve. | All events finish before bonus completion. | Bonus total includes every final win exactly once. | Completion overlay waits. | Critical | P0 |  |
| INT-020 | Feature Intersection | Natural bonus after base teaser | Rare base fire spin also ends with alarms | Resolve. | Existing base outcome resolves; bonus entitlement honored without post-result forcing. | Base/bonus totals separately logged. | Transition order coherent. | High | P1 |  |
| BOUND-001 | Boundary & Fraud | Spam Spin | Rapid click/tap Spin repeatedly | Spam during active spin. | Only one spin/wager accepted. | busy gate blocks overlap. | Button visibly disabled. | Critical | P0 |  |
| BOUND-002 | Boundary & Fraud | Bet during spin | Attempt bet +/- during cascade/bonus | Interact. | Bet cannot change until spin complete. | Wager uses locked starting bet. | Controls disabled. | Critical | P0 |  |
| BOUND-003 | Boundary & Fraud | Insufficient balance | Balance below bet | Spin. | No wager/result generated. | Balance unchanged. | Clear error state. | High | P0 |  |
| BOUND-004 | Boundary & Fraud | Malformed debug math | Blank/NaN/out-of-range debug values | Apply config. | Blank means profile default; invalid values rejected/clamped. | No NaN enters RNG/math. | Config inspector shows effective values. | High | P0 |  |
| BOUND-005 | Boundary & Fraud | Negative symbol weight | Set negative weight | Apply. | Rejected or clamped nonnegative. | Weighted pool never negative. | Clear effective config. | High | P1 |  |
| BOUND-006 | Boundary & Fraud | Zero total symbol weights | Set every weight to zero | Attempt spin. | Engine must fail safely rather than return undefined symbol. | No payout from invalid board. | Recoverable error message. | Critical | P0 |  |
| BOUND-007 | Boundary & Fraud | Extreme Fire multiplier | Create 1000000x Fire Wild in debug | Resolve win/compression. | Finite arithmetic; no Infinity/NaN. | Exact value within JS safe range policy. | UI remains readable/nonblocking. | Critical | P1 |  |
| BOUND-008 | Boundary & Fraud | Infinity / NaN injection | Manipulate client dev state | Evaluate. | Production architecture must reject malformed authoritative payloads. | No balance mutation from non-finite amount. | Error safely displayed. | Critical | P0 |  |
| BOUND-009 | Boundary & Fraud | Debug control exposure | Production build | Load game. | Developer UI absent/disabled. | No debug action callable through player UI. | No DEV/QA button. | Critical | P0 |  |
| BOUND-010 | Boundary & Fraud | Client payout manipulation | Modify DOM displayed win | Complete spin. | Authoritative accounting ignores DOM. | Server result/balance remains source of truth in production. | Display may change but payout does not. | Critical | P0 |  |
| BOUND-011 | Boundary & Fraud | Replay seeded debug | Reuse test seed intentionally | Run debug cases. | Reproducible in dev only; production RNG unaffected. | Seed path disabled in production. | Debug indicator visible. | Critical | P0 |  |
| BOUND-012 | Boundary & Fraud | Forced modes leakage | Set forced mode then return normal | Spin twice. | Forced mode consumed once; second spin normal. | pendingGameMode resets. | UI status returns normal. | Critical | P0 |  |
| BOUND-013 | Boundary & Fraud | Debug Buy double click | Configured dev price | Double-click TEST BUY. | busy gate prevents overlapping buys. | Cost/win applied once. | Button should be disabled in future refinement. | Critical | P0 |  |
| BOUND-014 | Boundary & Fraud | Huge wager request | Production API test | Submit beyond configured range. | Rejected server-side. | No balance underflow/overflow. | Player receives safe message. | Critical | P0 |  |
| BOUND-015 | Boundary & Fraud | Browser refresh | During idle and active states | Refresh. | Prototype resets; production must restore authoritative state. | Documented production gap. | No misleading duplicate result. | Critical | P0 |  |
| ANIM-001 | Animation & UX | Outcome independence | Same seed at 0.25x/1x/2x/turbo | Run identical seeded scenario. | Mathematical result identical at every speed. | Board/wins/fire state hashes match. | Only timing changes. | Critical | P0 |  |
| ANIM-002 | Animation & UX | Reduced motion | OS prefers-reduced-motion | Run spin/bonus. | Mechanics complete without dependence on WAAPI. | Same state/payout. | Animations collapse safely. | High | P0 |  |
| ANIM-003 | Animation & UX | Ignition readability | Normal→Burning | Observe. | Underlying symbol, fire state, and 2x all visible. | No state mismatch. | Fast pulse/embers, not obscuring art. | Medium | P1 |  |
| ANIM-004 | Animation & UX | Smoulder readability | Burning→Smouldering | Observe. | Clearly dormant vs active Burning; multiplier remains visible. | Correct state. | Reduced flame/darker visual. | Medium | P1 |  |
| ANIM-005 | Animation & UX | Spread readability | Multiple sources/targets | Observe. | Source pulse and rapid target combustion communicate spread without traveling flame. | Targets match mechanics. | No misleading diagonal travel. | High | P1 |  |
| ANIM-006 | Animation & UX | Spray readability | Any row | Observe full event. | Horizontal blast precedes downward drip and multiplier change. | Affected rows match state. | Water explains lower-row effect. | High | P1 |  |
| ANIM-007 | Animation & UX | Backdraft pacing | Eligible board | Observe. | Quiet pause/pressure buildup precedes burst. | Eligibility predetermined before burst. | Violent resolution then spread. | High | P1 |  |
| ANIM-008 | Animation & UX | Compression clarity | 5+ survivors | Observe. | Normals drop, fire converges, total Wild forms, banks downward. | Math total matches display. | No teleport/snap artifact. | High | P1 |  |
| ANIM-009 | Animation & UX | Alarm anticipation truthfulness | Actual board contains meaningful alarm progression | Observe initial/cascade drops. | Anticipation only when generated alarms justify it. | Outcome unchanged. | No fake near miss. | Critical | P0 |  |
| ANIM-010 | Animation & UX | Big Win skip | Trigger each tier | Tap overlay during count. | Immediately finishes count without changing total. | Resolved total unchanged. | Overlay exits cleanly. | High | P1 |  |
| ANIM-011 | Animation & UX | Particle cleanup | Max-intensity scenario repeatedly | Inspect DOM after effects. | Particle count remains bounded and elements clean up. | No game-state effect. | No progressive slowdown. | High | P1 |  |
| ANIM-012 | Animation & UX | Mobile 320px | Narrow viewport | Play base/bonus/open QA if dev. | No page horizontal clipping; controls tappable. | No state difference. | Board and overlays remain legible. | High | P1 |  |
| ANIM-013 | Animation & UX | Desktop resize | Resize during animation | Resize window. | No crash or state corruption. | Outcome unchanged. | Animation may settle but UI recovers. | Medium | P2 |  |
| ANIM-014 | Animation & UX | Long cascade | Seed heavy cascade | Run. | Minor events remain brisk; no excessive dead time. | All cascades counted. | Pacing escalates with meaningful events. | Medium | P1 |  |
| ANIM-015 | Animation & UX | Maximum fire board performance | Half/full board fire states | Run particles/spread/backdraft. | Frame remains responsive; FX stays within cap. | No skipped mechanics. | Effects clean after completion. | High | P1 |  |
| DBG-001 | Debug / Production | Direct bonus entry | Use 3/4/5 buttons | Enter bonus. | Runs shared bonus engine; balance unchanged. | No separate fake bonus math. | Clearly labeled debug. | High | P0 |  |
| DBG-002 | Debug / Production | Bonus Buy harness | Set positive dev price | Test buy. | Dev cost deducted once; bonus uses shared engine. | Stats/balance consistent for harness. | Explicit dev pricing label. | High | P1 |  |
| DBG-003 | Debug / Production | Spray row matrix | Run all 7 rows | Observe/log. | Every row can be deterministically exercised. | Coverage correct each row. | Row display correct. | High | P1 |  |
| DBG-004 | Debug / Production | Self-test suite | Run core self-tests | Inspect output. | Additive multiplier/Spray/Backdraft/compression/multi-spread checks pass. | Failures logged. | No persistent test mutation. | High | P0 |  |
| DBG-005 | Debug / Production | Event history | Run complex 5-Alarm | Inspect log. | Ordered events include spin, wins, fire, Spray, Backdraft, compression, completion. | Spin IDs/sequences monotonic. | Log readable and bounded. | High | P1 |  |

## Recommended regression suites

### P0 smoke on every commit
Run all Critical/P0 cases that are automatable, plus:
- syntax/static validation;
- duplicate DOM ID check;
- missing referenced element check;
- core self-tests;
- forced 3/4/5 Alarm;
- multi-source spread;
- Spray row 1 and row 7;
- true and false Backdraft;
- 5-Alarm compression;
- Fire Wild removal;
- 0.25× and turbo outcome-equivalence;
- spam Spin.

### Nightly deterministic suite
Maintain a bank of known debug seeds covering:
- no win;
- single cascade;
- 10+ cascades;
- 3-Alarm;
- 4-Alarm;
- 5-Alarm;
- multiple fires;
- partial Spray;
- full extinguish;
- Backdraft;
- high Fire Wild;
- Fire Wild removal;
- large total win.

Store expected state snapshots and payout totals. Presentation screenshots may be compared separately, but never use screenshot output as the payout oracle.

### Performance suite
Stress:
- 49 fire-affected cells;
- max configured particles;
- repeated Backdraft effects;
- 20+ cascades;
- 10 5-Alarm spins at turbo;
- repeated open/close of debug dialog.

Watch detached DOM nodes, active animation count, heap growth and frame time.

## Final review / next steps

1. Freeze mechanics before math calibration. Frequent mechanic changes invalidate RTP work.
2. Extract a pure, presentation-free math engine used by both the game and simulator.
3. Build deterministic seeded regression fixtures from that engine.
4. Calibrate full-game RTP/volatility and document every probability/profile.
5. Add server-authoritative result/wallet/reconnect architecture.
6. Remove debug UI/code from production bundle.
7. Add automated browser/device tests for desktop and mobile.
8. Add production VFX/audio only after event timing is mechanically stable.
9. Run destructive/replay/fraud tests against the server API, not only the browser.
10. Submit only after independent math review and jurisdiction-specific lab requirements are satisfied.
