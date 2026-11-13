import { LibMedia } from "../libmedia/libmedia.js";
import { LibMidi, createUnlockingAudioContext } from "../libmidi/libmidi.js";
import { codeMap, KeyRepeatManager } from "./key.js";
import { EventQueue } from "./eventqueue.js";
import { initKbdListeners, setKbdHandler, kbdWidth, kbdHeight } from "./screenKbd.js";

// we need to import natives here, don't use System.loadLibrary
// since CheerpJ fails to load them in firefox and we can't set breakpoints
import canvasFontNatives from "../libjs/libcanvasfont.js";
import canvasGraphicsNatives from "../libjs/libcanvasgraphics.js";
import gles2Natives from "../libjs/libgles2.js";
import jsReferenceNatives from "../libjs/libjsreference.js";
import mediaBridgeNatives from "../libjs/libmediabridge.js";
import midiBridgeNatives from "../libjs/libmidibridge.js";

const evtQueue = new EventQueue();
const sp = new URLSearchParams(location.search);

const cheerpjWebRoot = '/app'+location.pathname.replace(/\/[^/]*$/,'');

const isMobile = sp.get('mobile');
const isEmbed = sp.get('embed') === '1';
const isPreloadOnly = sp.get('preload') === '1';

if (isEmbed && typeof document !== 'undefined') {
    document.body.classList.add('embed-mode');
}

let display = null;
let screenCtx = null;
let gameAudioCtx = null;
let gameGainNode = null;
let currentMasterVolume = sp.get('volume') !== null ? Math.max(0, Math.min(1, Number(sp.get('volume')) || 0)) : 1.0;

let fractionScale = sp.get('fractionScale') || (localStorage && localStorage.getItem("pl.zb3.freej2me.fractionScale") === "true");
let scaleSet = false;

const keyRepeatManager = new KeyRepeatManager();

window.evtQueue = evtQueue;

function notifyParent(payload) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
    }
}

function resumeGameAudio() {
    if (gameAudioCtx && gameAudioCtx.state === 'suspended') {
        gameAudioCtx.resume().catch(() => {});
    }
    if (window.libmedia && typeof window.libmedia.unlockAll === 'function') {
        window.libmedia.unlockAll();
    }
}

function setMasterGameVolume(vol) {
    currentMasterVolume = Math.max(0, Math.min(1, Number(vol) || 0));
    resumeGameAudio();
    if (gameGainNode) {
        gameGainNode.gain.value = currentMasterVolume;
    }
    if (window.libmedia && typeof window.libmedia.setMasterVolume === 'function') {
        window.libmedia.setMasterVolume(currentMasterVolume);
    }
}

function autoscale() {
    if (!scaleSet) return;

    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;

    if (isMobile) {
        document.getElementById('left-keys').style.display = '';
        document.getElementById('right-keys').style.display = '';

        if (screenWidth > screenHeight) {
            document.body.classList.add('kbd-landscape');
            document.body.classList.remove('kbd-portrait');
            screenWidth = screenWidth - 2*kbdWidth;
        } else {
            document.body.classList.add('kbd-portrait');
            document.body.classList.remove('kbd-landscape');
            screenHeight = screenHeight - kbdHeight;
        }
    }

    let scale = Math.min(
        screenWidth/screenCtx.canvas.width,
        screenHeight/screenCtx.canvas.height
    );

    if (!fractionScale) {
        scale = scale|0;
    }

    display.style.zoom = scale;
}

function setListeners() {
    let mouseDown = false;
    let noMouse = false;

    setKbdHandler((isDown, key) => {
        const symbol = key.startsWith('Digit') ? key.substring(5) : '\x00';
        keyRepeatManager.post(isDown, key, {symbol, ctrlKey: false, shiftKey: false});
    });

    function handleKeyEvent(e) {
        const isDown = e.type === 'keydown';

        if (codeMap[e.code]) {
            keyRepeatManager.post(isDown, e.code, {
                symbol: e.key.length == 1 ? e.key.charCodeAt(0) : '\x00',
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey
            })
        }
        e.preventDefault();
    }

    display.addEventListener('keydown', handleKeyEvent);
    display.addEventListener('keyup', handleKeyEvent);

    keyRepeatManager.register((kind, key, args) => {
        if (kind === 'click') {
            if (key === 'Maximize') {
                fractionScale = !fractionScale;
                localStorage && localStorage.setItem("pl.zb3.freej2me.fractionScale", fractionScale);
                autoscale();
            }
        } else if (codeMap[key]) {
            console.log('queuin event');
            evtQueue.queueEvent({
                kind: kind === 'up' ? 'keyup' : 'keydown',
                args: [codeMap[key], args.symbol, args.ctrlKey, args.shiftKey]
            });
        }
    });

    display.addEventListener('mousedown', async e => {
        display.focus();
        if (noMouse) return;

        evtQueue.queueEvent({
            kind: 'pointerpressed',
            x: e.offsetX / display.currentCSSZoom | 0,
            y: e.offsetY / display.currentCSSZoom | 0,
        });

        mouseDown = true;

        e.preventDefault();
    });

    display.addEventListener('mousemove', async e => {
        if (noMouse) return;
        if (!mouseDown) return;

        evtQueue.queueEvent({
            kind: 'pointerdragged',
            x: e.offsetX / display.currentCSSZoom | 0,
            y: e.offsetY / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    });

    document.addEventListener('mouseup', async e => {
        if (noMouse) return;
        if (!mouseDown) return;

        mouseDown = false;

        evtQueue.queueEvent({
            kind: 'pointerreleased',
            x: (e.pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    });


    display.addEventListener('touchstart', async e => {
        display.focus();
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerpressed',
            x: (e.changedTouches[0].pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.changedTouches[0].pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    }, {passive: false});

    display.addEventListener('touchmove', async e => {
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerdragged',
            x: (e.changedTouches[0].pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.changedTouches[0].pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    }, {passive: false});

    display.addEventListener('touchend', async e => {
        noMouse = true;

        evtQueue.queueEvent({
            kind: 'pointerreleased',
            x: (e.changedTouches[0].pageX - display.offsetLeft) / display.currentCSSZoom | 0,
            y: (e.changedTouches[0].pageY - display.offsetTop) / display.currentCSSZoom | 0,
        });

        e.preventDefault();
    });

    if (!isEmbed) {
        document.addEventListener('mousedown', e => {
            console.log('refocus');
            setTimeout(() => display.focus(), 20);
        });

        display.addEventListener('blur', e => {
            console.log('refocus');
            // it doesn't work without any timeout
            setTimeout(() => display.focus(), 10);
        });
    }

    window.addEventListener('message', e => {
        const data = e.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'freej2me:key' && data.code) {
            resumeGameAudio();
            const symbol = data.symbol && data.symbol.length === 1
                ? data.symbol.charCodeAt(0)
                : (data.code.startsWith('Digit') ? data.code.charCodeAt(5) : 0);
            keyRepeatManager.post(!!data.down, data.code, {
                symbol,
                ctrlKey: false,
                shiftKey: false,
            });
        } else if (data.type === 'freej2me:setVolume') {
            setMasterGameVolume(data.volume);
        } else if (data.type === 'freej2me:focus') {
            resumeGameAudio();
            display.focus();
        }
    });

    window.addEventListener('resize', autoscale);

    initKbdListeners();
}

function setFaviconFromBuffer(arrayBuffer) {
    const blob = new Blob([arrayBuffer], { type: 'image/png' });

    const reader = new FileReader();
    reader.onload = function() {
        const dataURL = reader.result;

        let link = document.querySelector("link[rel*='icon']");
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'icon');
            document.head.appendChild(link);
        }
        link.setAttribute('href', dataURL);
    };
    reader.readAsDataURL(blob);
}

async function ensureAppInstalled(lib, appId) {
    const appFile = await cjFileBlob(appId + "/app.jar");

    if (!appFile) {
        const launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;

        await launcherUtil.installFromBundle(cheerpjWebRoot + "/apps/", appId);
    }
}

async function kvToJava(lib, kv) {
    const HashMap = await lib.java.util.HashMap;
    const map = await new HashMap();
    for (const k of Object.keys(kv)) {
        await map.put(k, String(kv[k]));
    }
    return map;
}

async function prepareRomApp(lib, romUrl) {
    const res = await fetch(romUrl);
    if (!res.ok) {
        throw new Error(`Impossible de charger le jeu (${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const launcherUtil = await lib.pl.zb3.freej2me.launcher.LauncherUtil;
    const MIDletLoader = await lib.org.recompile.mobile.MIDletLoader;
    const File = await lib.java.io.File;

    await launcherUtil.resetTmpDir();
    const fileName = decodeURIComponent(romUrl.split('/').pop() || 'game.jar');
    const jarFile = await new File('/files/_tmp/launch.jar');
    await launcherUtil.copyJar(new Int8Array(arrayBuffer), jarFile);

    const loader = await MIDletLoader.getMIDletLoader(jarFile);
    await launcherUtil.ensureAppId(loader, fileName);
    const appId = await loader.getAppId();

    const width = sp.get('width') || '176';
    const height = sp.get('height') || '220';
    const phone = sp.get('phone') || 'Motorola';
    const settingsMap = await kvToJava(lib, {
        width,
        height,
        phone,
        sound: 'on',
    });

    const existingApp = (await cjFileBlob('/files/' + appId + '/app.jar')) || (await cjFileBlob(appId + '/app.jar'));
    if (!existingApp) {
        await launcherUtil.initApp(jarFile, loader, settingsMap, null, null);
    } else {
        await launcherUtil.saveApp(appId, settingsMap, null, null);
    }

    await loader.close();
    return appId;
}

async function init() {
    if (isPreloadOnly) {
        await cheerpjInit({ enableDebug: false });
        await cheerpjRunLibrary(cheerpjWebRoot + "/freej2me-web.jar");
        notifyParent({ type: 'freej2me:preloaded' });
        return;
    }

    document.getElementById("loading").textContent = "Loading CheerpJ...";

    display = document.getElementById('display');
    screenCtx = display.getContext('2d');

    setListeners();

    const audioCtx = createUnlockingAudioContext();
    gameAudioCtx = audioCtx;
    gameGainNode = audioCtx.createGain();
    gameGainNode.gain.value = currentMasterVolume;
    gameGainNode.connect(audioCtx.destination);

    window.libmidi = new LibMidi(audioCtx, gameGainNode);
    await window.libmidi.init();
    window.libmidi.midiPlayer.addEventListener('end-of-media', e => {
        window.evtQueue.queueEvent({kind: 'player-eom', player: e.target});
    });
    window.libmedia = new LibMedia();
    window.libmedia.setMasterVolume(currentMasterVolume);

    await cheerpjInit({
        enableDebug: false,
        natives: {
            ...canvasFontNatives,
            ...canvasGraphicsNatives,
            ...gles2Natives,
            ...jsReferenceNatives,
            ...mediaBridgeNatives,
            ...midiBridgeNatives,
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setTitle(lib, title) {
                document.title = title;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setIcon(lib, iconBytes) {
                if (iconBytes) {
                    setFaviconFromBuffer(iconBytes.buffer);
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_getScreenCtx(lib) {
                return screenCtx;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_setCanvasSize(lib, width, height) {
                if (!scaleSet) {
                    document.getElementById('loading').hidden = true;
                    display.style.display = '';
                    scaleSet = true;
                    display.focus();
                    notifyParent({ type: 'freej2me:ready', width, height });
                }
                screenCtx.canvas.width = width;
                screenCtx.canvas.height = height;
                autoscale();
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_waitForAndDispatchEvents(lib, listener) {
                const KeyEvent = await lib.pl.zb3.freej2me.bridge.shell.KeyEvent;
                const PointerEvent = await lib.pl.zb3.freej2me.bridge.shell.PointerEvent;

                const evt = await evtQueue.waitForEvent();
                if (evt.kind == 'keydown') {
                    await listener.keyPressed(await new KeyEvent(...evt.args));
                } else if (evt.kind == 'keyup') {
                    await listener.keyReleased(await new KeyEvent(...evt.args));
                } else if (evt.kind == 'pointerpressed') {
                    await listener.pointerPressed(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'pointerdragged') {
                    await listener.pointerDragged(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'pointerreleased') {
                    await listener.pointerReleased(await new PointerEvent(evt.x, evt.y));
                } else if (evt.kind == 'player-eom') {
                    await listener.playerEOM(evt.player);
                } else if (evt.kind == 'player-video-frame') {
                    await listener.playerVideoFrame(evt.player);
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_restart(lib) {
                location.reload();
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_exit(lib) {
                if (isEmbed) {
                    notifyParent({ type: 'freej2me:exit' });
                } else {
                    location.href = './';
                }
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_sthop(lib) {
                debugger;
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_say(lib, sth) {
                console.log('[say]', sth);
            },
            async Java_pl_zb3_freej2me_bridge_shell_Shell_sayObject(lib, label, obj) {
                debugger;
                console.log('[sayobject]', label, obj);
            }
        }
    });

    document.getElementById("loading").textContent = "Loading...";

    const lib = await cheerpjRunLibrary(cheerpjWebRoot+"/freej2me-web.jar");

    const FreeJ2ME = await lib.org.recompile.freej2me.FreeJ2ME;

    let args;

    if (sp.get('app')) {
        const app = sp.get('app');
        await ensureAppInstalled(lib, app);

        args = ['app', sp.get('app')];
    } else if (sp.get('rom')) {
        try {
            const appId = await prepareRomApp(lib, sp.get('rom'));
            args = ['app', appId];
        } catch (err) {
            console.error(err);
            notifyParent({ type: 'freej2me:error', message: err?.message || 'Erreur de chargement ROM' });
            document.getElementById('loading').textContent = 'Erreur de chargement ROM';
            return;
        }
    } else {
        args = ['jar', cheerpjWebRoot+"/jar/" + (sp.get('jar') || "game.jar")];
    }

    FreeJ2ME.main(args).catch(e => {
        if (typeof e?.printStackTrace === 'function') e.printStackTrace();
        else console.error(e);
        notifyParent({ type: 'freej2me:error', message: 'Crash émulateur J2ME' });
        document.getElementById('loading').textContent = 'Crash :(';
    });


}

init();