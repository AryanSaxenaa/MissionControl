import { Composition } from 'remotion'
import { MissionControlShowcase } from './Showcase'

// 10 slides × 270 frames = 2700 frames @ 30fps = 90 seconds
const TOTAL_FRAMES = 2700

export function RemotionRoot() {
  return (
    <Composition
      id="MissionControlShowcase"
      component={MissionControlShowcase}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
