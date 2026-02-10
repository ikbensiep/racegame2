# RACE GAME 2

last edit: 10/02/2026 - 16:14

## Overview
In this game, the **Player** is a Racing Driver, their **Career** spans several **Seasons** of Race **Events**.

This not a racing sim. It's an adventure/RPG/rogue-like (fuck idk these gaming terms) with a racing component to it. 

### Lore

It's about the fun you had with your favorite matchbox or model kit toy cars when you were a kid. Racing on the streets of the bedroom floor mat - yes, _that_ bedroom floor mat, outside in a sandbox with more heavy-duty plastic toy digger machines and construction cranes, imagining how your favorite Darda (tm) cars would roar around a real racetrack. 

If only you weren't still a kid back then, you'd have _known_ the smell of hot exhaust pipes, that "burning fuel" actually means more than just turning it into heat energy (hint: it _does_ kinda burn on your skin, ask how I know) and what burning rubber smells like, but back there and then you could at least _imagine_ some of these things.

## Player objectives

Over `Carreer[currentSeason].Events.length`, a player must gather the most **Championship Points** (CP) in order to win the Championship that Season.
During a race weekend, **Racing Experience** (XP), Championship Points (CP) and **Money** ($), may be earned. 

> **NOTE** Potentially, a combination of these could resolve to an overall **Reputation Points** (RP) score, but maybe that's making things a bit too complex for now. 

### (TODO: refine)
After winning a Championship, the player has 'graduated' and is now granted access to the online **Multiplayer** world where they can compete against other human-players in various (types of?) **Lobbys**.


## TECH/DEV GOALS
To develop (a system to develop) engaging html5 games _without_ needing to go `webGL` or `Canvas`/`ThreeJS`.
 Those systems are all fantastic in and of themselves, but are somewhat cumbersome to start a game development journey with. This project aims to stick as much as possible to clean & lean `html`, `css`, `svg` (ok and some `js`) for the delivery of excellent audio-, visual- and haptic experiences and feedback.

💡 Note that _lean_ does not equal **plain**. 
We can combine clipping, masking, blending/compositing and svg filtering to achieve a _very_ rich user experience.

We pull out all stops (gamepad API, audio / filter APIs, graphics, haptics, networkcomms, pixel baking etc etc) to 
deliver a grand experience. Idk what other stuff we can tap into but we'll find it. Geolocation?

This project is an ode (of sorts) to the Almighty Web Browser And Its Rendering Engine (`AWBAIRE`) and what experiences it may offer other than [[doomscrolling]] to both creators and consumers (editor's note: surely there must be a better word for that. Less-than-creative Active Participants?).

That's a long introduction just to say: today, players can select a base `background-color` for their vehicle, soon they'll be pasting stacks of CSS `*-gradient()`s as both `background-image` and `mask-image`s to design (and share!) their own sick liveries.

Type shi.

## TODOs
- [ ] Clean up this doc
- [ ] Write Design Doc of sorts?
- [ ] Add credits.txt?
- [ ] Create project, milestones 

## SOLO GOAL: become champion over a Career
- [ ] a Career may span multiple Championship Seasons
- [ ] a Season is a Map() of Events.
- [ ] Players can compete in (unlocked) Events.
- [ ] Events unlock in the player's first Season, after completing a race in either a previous or their first (ever) Event.
- [ ] Events consist of multiple Sessions (training, qualifying, race [,race 2?])
- [ ] During a Session, $, XP and CP can be won by completing various driving objectives (distance traveled, % of clean laps, best lap time, qualifying position, race overtakes, race result etc.)
- [ ] During a Session, penalties in various degrees may be received (off track, colliding, speeding in pitlane etc.)

- [ ] Before and after Event Sessions, the player must complete varying Tasks in 'RPG mode' in order to continue to the next Session in the Event.
  - [ ] Tasks may be completed in various ways (check in, collect, purchase etc..) and may or may not be time limited.
  - [ ] Completing (some of) these tasks may increase XP or $, depending on their objective. /* This needs to be more specced out */

- [ ] After completing a session, the player spawns in their Motorhome/Garagebox (ie, their paddock spawn point)
- [ ] After completing an Event, the player returns to their team HomeBase
  - [ ] At both the HomeBase and Motorhome/Garagebox, some management tasks can be completed and unlocked perks/customizations can be purchased/applied.
  - [ ] 
  - [ ] Eventually, investigate the option to utilize `<canvas>` to allow players to design their own liveries

- [CP] are added to a Player's Season results to compete for the Championship Title
- [XP] **unlock** available customizations/perks/upgrades.
- [$] are required to **purchase** these customizations/perks/upgrades.
- Upgrades may increase maxSpeed, maxSteering (and maxAccel?), increasing the chances of gaining [CP] and becoming champion
- Becoming Champion may unlock different Perks, such as Exclusive Vehicles, a Livery Editor and more.

## MULTIPLAYER GOAL

- [ ] Phase 1: Just a fun way to play 'bumpercars' with friends
- [ ] Phase 2/3?: Community to collect and share (show off) either earned/rare or self-made customization(s)?
- [ ] Global leaderboards with laptimes per Venue?
- [ ] Bluesky login?

# RACE WEEKEND (Event) STRUCTURE

- [ ] 1. Spawn as character outside Motorhome/Truck in Paddock [RPG mode]

  - [ ] Task: check in and attend driver meeting at Race Control
  - [ ] Task: gather/purchase supplies (tires, fuel)
  - [ ] Task: (optional) purchase/equip upgrades
  - [ ] Task: Park racecar in pitlane service area box to start Practice (Session 1)

- [ ] 3. A: Free practice (Session 1)
  - [ ] (optional) car setup in service area
  - [ ] Start practice clock, 10 mins to drive laps
  - [ ] Earn XP for completed laps
  - [ ] Earn XP for clean lap
  - [ ] Earn XP for best lap time
  - [ ] Task: Complete practice programme (set N laps / adjust `car.section.settings`?)
  - [ ] Earn XP for completing Task
  - [ ] Return to garage (trailer?) to end Practice Session 1

- [ ] 3. B: Post-practice / prep Qualifying (Session 2) [RPG mode]

- [ ] 4. A: Qualifying (Session 2)
  - [ ] Earn XP for completed lap
  - [ ] Earn XP for best lap time
  - [ ] Earn XP for clean lap 
  - [ ] Task: Complete qualifying programme (stay close to racing line, TODO: add `#racingline` (not `#racetrack`!)`<path>` element with smaller width to track map files)
  - [ ] Earn XP for high racing line percentage (@see TODO)
  - [ ] Return to garage (trailer?) to end Qualifying (Session 2)
  - [ ] Challenge: Drivers may randomly be called into the weigh bridge.
  - [ ] Earn XP for completing the Challenge, receive a penalty for missing.

- [ ] 4. B: Post-qualifying [RPG mode]
  - [ ] Challenge. Visit scrutineering after qualifying time ends -> skipping may result in random penalty awarded after race

- [ ] 5. Race
  - [ ] Spawn in garage, drive to starting grid slot (simpler: spawn at grid slot)
  - [ ] Drive ~5 laps after starting signal
  - [ ] Earn CP, $ for finising position
  - [ ] Earn XP for # of completed laps
  