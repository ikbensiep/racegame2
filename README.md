# racegame2

racegame 2: multiplayer boogaloo

This is a cleanup of the previous racegame engine.
According to gamedev YouTube We need to make Small Games, which is why the plans for this are huge and ambitious and, of course, still somewhat vague. Keepin' it small & real with incremental updates, because the end goal is too much fun to lose out of sight. I'll documment it properly here, "one day", there's some scattered pen&paper notes and `.md` files arounmd my desk so.

Stay tuned?

## Lore

Funnily enough, this started out when I went to bed angrily, unable to solve the rendering issues I was facing in chrome. I then came up with some sort of tiling system and detecting which tile is active using "only" `playerElement.scrollIntoView()` and `intersectionObserver`.

By the time that was done and I had some leaner markup to draw the world (hint: use CSS background instead of "live" <img> elements, read on as for the how & why!), this automatically clips the drawing layers to whatever the viewport size is. In the old version, i'd have saveral `<imgs>`s and `<div>`s containing world layers @ around 32k squared, and all would be rendered at that size, even though I'd have it in a container which I guess would clip things off.

Fine, with this updated rendering routine out of the way, in one morning I *did* have a ~60fps prototype of the game.
And a tiling system that was now no longer necessary. It's still neat and I don't have a purpose for it so for now it stays in here, lurking in the code. Might come in handy for other stuff later, who knows. 

For now, it's commented out in World.js: look for the `_initWorld` 👻 ghost function. You can also find it in the now-defunct sketch.js, if I'm not mistaken you could just include that instead of main.js and have the entire freakin game loop working. It's near criminal, really.

