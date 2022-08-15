import { AmplitudeEnvelope, Panner } from "tone";
import { formatTime, getDisposable, getClassSetters, getClassMethods, isMutableKey, getSchedulable } from './utils/core'
import { formatCurve, timeToEvent } from "./utils/tone";

class BaseSynth {
    dur = 1;
    amp = 1;
    envelope;
    self = this.constructor
    #disposed = false
    disposeTime;
    onDisposeAction;                                                                                                                                     n = () => null;
    
    constructor() {
        this.panner = new Panner(0)
        this.envelope = new AmplitudeEnvelope({attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8})
        this.envelope.connect(this.panner)
    }

    #settable() {
        return [
            ...getClassSetters(BaseSynth), 
            ...getClassSetters(this.self)
        ].reduce((obj, key) => ({
            ...obj,
            [key]: (value) => this[key] = value
        }), {})
    }

    #mutable() {
        return [
            ...getClassMethods(BaseSynth), 
            ...getClassMethods(this.self)
        ]
            .filter(isMutableKey)
            .reduce((obj, key) => ({
                ...obj,
                [key]: this[key]
            }), {})
    }

    setParams(params) {
        const settable = this.#settable()
        Object.entries(params).forEach(([key, value]) => {
            settable[key] && (this[key] = value)
        });
    }

    play(params = {}, time) {
        const seconds = formatTime(time)
        this.setParams(params)
        this.envelope.triggerAttackRelease(this.dur, seconds, this.amp)
        this.disposeTime = seconds + this.dur + this.envelope.release + 0.1

        setTimeout(
            () => this.dispose(), 
            (timeToEvent(time) + this.dur + this.envelope.release + 0.1) * 1000
        )
    }

    mutate(params = {}, time, lag) {
        const props = this.mutable
        Object.entries(params).forEach(([key, value]) => {
            props[key] && props[key](value, time, lag)
        })
    }
    
    cut(time) {
        const seconds = formatTime(time)
        this.envelope.set({release: 0.1})
        this.envelope.triggerRelease(seconds)
        this.disposeTime = seconds + this.envelope.release + 0.1
        setTimeout(
            () => this.dispose(), 
            (timeToEvent(time) + this.envelope.release + 0.1) * 1000
        )
    }

    connect(node) {
        this.panner.disconnect()
        this.panner.connect(node)
    }

    chain(...nodes) {
        this.panner.disconnect()
        this.panner.chain(...nodes)
    }

    dispose() {
        if(this.#disposed) return

        getDisposable(this).forEach(prop => prop.dispose())
        this.onDisposeAction && this.onDisposeAction()
        this.#disposed = true
    } 

    set dur(value) { this.dur = value }
    set amp(value) { this.amp = value }

    set a(value) { this.envelope.attack = value }
    set d(value) { this.envelope.decay = value }
    set s(value) { this.envelope.sustain = value }
    set r(value) { this.envelope.release = value }
    
    set acurve(value) { this.envelope.attackCurve = formatCurve(value) }
    set dcurve(value) { this.envelope.decayCurve = formatCurve(value) }
    set rcurve(value) { this.envelope.releaseCurve = formatCurve(value) }    

    set curve(value) { 
        this.acurve = formatCurve(value)
        this.dcurve = formatCurve(value)
        this.rcurve = formatCurve(value)
    }

    set pan(value) { this.panner.pan.setValueAtTime(value, 0) }
    
    _pan(value, time, lag = 0.1) { this.panner.pan.rampTo(value, lag, time) }
    _pan = this._pan.bind(this)

    get settable() { return this.#settable() }
    get mutable() { return this.#mutable() }
    get automated() { return getSchedulable(this)}
    get disposeTime() { return this.disposeTime }
}

export default BaseSynth