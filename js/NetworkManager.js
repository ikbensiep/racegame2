import AIOpponent from './AIOpponent.js';

export default class NetworkManager {
    constructor(game, onOpponentUpdate) {
      this.isHost = false; 
      this.game = game;
      this.peerReady = false;
      this.peer = new Peer(undefined, {
        config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        // Forceert de browser om sneller op te geven bij slechte verbindingen
        'iceCandidatePoolSize': 10
        },
        debug: 2
      });
      
      // keep track of all active peer connections (host and clients)
      this.connections = new Map();
      this.onOpponentUpdate = onOpponentUpdate;
      
      this._init();
    }

    _init() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('join');

        this.peer.on('open', (id) => {
            this.peerReady = true;
            if (joinId) {
              // we joined an invite
              this.connect(joinId);
            } else { 
              
                this.isHost = true;
                console.info("👑 Je bent de Host. Jij beheert de bots.");
              
              // we can invite other players
              this.game.inviteLink = `📨 Invite link: ${window.location.origin}${window.location.pathname}?join=${id}&track=${this.game.scene}`;
            }
        });

        this.peer.on('connection', (c) => this._setupConnection(c));
    }

    connect(id) {
        this._setupConnection(this.peer.connect(id));
    }

    async waitForPeerReady() {
        // Wait until the peer 'open' event fires and isHost is determined
        while (!this.peerReady) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    _setupConnection(c) {

      // remember this connection by peer id (allows multiple players)
      this.connections.set(c.peer, c);

      c.on('data', (data) => {
        // ignore our own echoed messages
        if (data.id === this.peer.id) return;

        // console.debug(`[network] data from ${c.peer}:`, data);
        // notify game logic
        this.onOpponentUpdate(data);

        // if we're the host, forward the message to everyone else
        if (this.isHost) {
        //   console.debug(`[network] host forwarding data from ${c.peer}`);
          this.broadcast(data, c.peer);
        }
      });

      c.on('open', () => {
        console.log("🤝 Handshakey! 🔌 Connected to:", c.peer);
        
        // send our own identity once the local player object is available
        // Don't include garageIndex yet - wait for host to tell us what's available
        const sendIdentity = () => {
          if (!this.game || !this.game.localPlayer) {
            // try again shortly
            setTimeout(sendIdentity, 50);
            return;
          }

          const lp = this.game.localPlayer;
          const pakketje = { 
            type: 'hello',
            id: this.peer.id,
            name: lp?.name || 'Anonymous Racer', // Zorg dat dit ergens staat
            driverNumber: lp?.driverNumber ?? 0,
            color: lp?.color || 'blue',
            team: lp?.team || 'porsche',
            livery: lp?.livery || 'default'
          };
          console.debug('[network] sending identity paketje:', pakketje);
          try { c.send(pakketje); } catch (e) { console.warn('Failed to send identity paketje, will retry', e); setTimeout(sendIdentity, 200); }
        };

        sendIdentity();

        // if we're the host, also let the newcomer know about everyone who's already joined
        if (this.isHost) {
            this.game.opponents.forEach(opp => {
                // Only send 'hello' about network peers, not AI opponents
                if (opp.id && opp.id !== this.peer.id && !(opp instanceof AIOpponent)) {
              const hello = {
                type: 'hello',
                id: opp.id,
                name: opp.name,
                driverNumber: opp.driverNumber,
                color: opp.color,
                team: opp.team,
                livery: opp.livery
              };
              console.debug('[network] host -> sending existing opponent to newcomer:', hello);
              c.send(hello);
                }
            });
        }
      });

      c.on('close', () => {
        this.connections.delete(c.peer);
      });
    }

    // send data to every connected peer.  If `excludeId` is provided the connection
    // belonging to that peer will be skipped (useful to avoid echoing a message back
    // to the originator when the host is forwarding).
    broadcast(data, excludeId = null) {
        this.connections.forEach((conn, peerId) => {
            if (peerId === excludeId) return;
            if (conn.open) conn.send(data);
        });
    }

    send(data) {
        // clients only have one connection (to the host), so this is a simple alias.
        // hosts will loop through all conns as well since broadcast is the same implementation.
        this.broadcast(data);
    }

    sendTo(peerId, data) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            conn.send(data);
        }
    }
}