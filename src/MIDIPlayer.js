import { useCardStyles } from './App'
import React, { useEffect, useState, useRef } from 'react'
import JSLibTimidity from 'js-libtimidity'
import EventEmitter from 'events'
import MIDIFile from 'midifile'
import MIDIEvents from 'midievents'
import Button from '@material-ui/core/Button'
import { PlayArrow } from '@material-ui/icons'
import StopIcon from '@material-ui/icons/Stop'
import Typography from '@material-ui/core/Typography'

const TIMIDITY_CFG = `
soundfont GeneralUserGSv1.471.sf2
`

function getFirstEffectiveMIDIEvent (midiBuf) {
  const midi = new MIDIFile(midiBuf)
  const events = midi.getMidiEvents()
  const ons = events.filter(ev => ev.subtype === MIDIEvents.EVENT_MIDI_NOTE_ON)
  if (ons.length === 0) throw new Error('invalid midi file')
  return ons[0]
}

class PCMPlayer extends EventEmitter {
  constructor (audioContext, pcm) {
    super()
    this._audioContext = audioContext
    this._pcm = pcm
    this._playing = false
    this._currentTime = 0
    this._offset = 0
    this._epoch = null
  }

  play () {
    if (this._playing) return

    const buffer = this._audioContext.createBuffer(
      this._pcm.numChannels,
      this._pcm.data.length / this._pcm.numChannels,
      this._pcm.sampleRate
    )
    for (let ch = 0; ch < this._pcm.numChannels; ch++) {
      const out = buffer.getChannelData(ch)
      for (let i = 0; i < out.length; i++) {
        const si = (this._offset + i) * this._pcm.numChannels + ch
        const s = si < this._pcm.data.length ? this._pcm.data[si] / 0x7fff : 0
        out[i] = s
      }
    }

    this._source = this._audioContext.createBufferSource()
    this._source.buffer = buffer
    this._source.connect(this._audioContext.destination)
    this._source.onended = this.stop

    this._epoch = this._audioContext.currentTime + 0.1
    this._source.start(this._epoch)

    this._playing = true
    this.emit('start')
  }

  stop = () => {
    if (!this._playing) return

    this._source.stop()

    this._playing = false
    this.emit('end')
  }

  getCurrentTime () {
    if (!this._epoch) return 0
    return this._audioContext.currentTime - this._epoch
  }
}

function MIDIPlayer ({ buffer, onReady, onPlay, onEnd }) {
  const [audioContext, setAudioContext] = useState(null)
  const [pcmPlayer, setPCMPlayer] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const refOnReady = useRef(onReady)
  const refOnPlay = useRef(onPlay)
  const refOnEnd = useRef(onEnd)
  const classes = useCardStyles()

  useEffect(() => {
    const audioContext = new AudioContext()
    setAudioContext(audioContext)
    return () => {
      audioContext.close()
    }
  }, [])
  useEffect(() => {
    if (!audioContext || !buffer) return
    async function f () {
      const synth = new JSLibTimidity(process.env.PUBLIC_URL, TIMIDITY_CFG, {
        sampleRate: audioContext.sampleRate,
        numChannels: 2
      })
      while (!synth.isReady()) await new Promise(r => setTimeout(r, 1000))
      let pcmWoRest = await synth.midi2wav(new Uint8Array(buffer))

      // Prefix 'rest' to pcmWoRest
      // c.f.: https://superuser.com/questions/737036/timidity-extract-tracks-preserving-initial-silence
      const restLength =
        (getFirstEffectiveMIDIEvent(buffer).playTime / 1000) *
        pcmWoRest.sampleRate *
        pcmWoRest.numChannels
      const pcm = {
        ...pcmWoRest,
        data: new Int16Array(restLength + pcmWoRest.data.length)
      }
      pcm.data.set(pcmWoRest.data, restLength)

      const player = new PCMPlayer(audioContext, pcm)
      if (refOnReady.current) refOnReady.current({ target: player })
      player.on('start', () => {
        if (refOnPlay.current) refOnPlay.current()
        setIsPlaying(true)
      })
      player.on('end', () => {
        if (refOnEnd.current) refOnEnd.current()
        setIsPlaying(false)
      })
      setPCMPlayer(oldPlayer => {
        if (oldPlayer) oldPlayer.stop()
        return player
      })
    }
    f()
  }, [buffer, audioContext])

  refOnReady.current = onReady
  refOnPlay.current = onPlay
  refOnEnd.current = onEnd

  if (isPlaying) {
    return (
      <Button size='large' variant='outlined' onClick={() => pcmPlayer.stop()}>
        <StopIcon className={classes.wrapIcon} />
        Stop
      </Button>
    )
  }

  if (pcmPlayer) {
    return (
      <Button size='large' variant='outlined' onClick={() => pcmPlayer.play()}>
        <PlayArrow className={classes.wrapIcon} />
        Play
      </Button>
    )
  }

  return <Typography component={'sub'}>Loading...</Typography>
}

export default MIDIPlayer
