import { AbsoluteFill, Series, interpolate, useCurrentFrame } from 'remotion'
import { TitleSlide }           from './slides/01-Title'
import { ProblemSlide }         from './slides/02-Problem'
import { SolutionSlide }        from './slides/03-Solution'
import { AgentFleetSlide }      from './slides/04-AgentFleet'
import { WorktreesSlide }       from './slides/05-Worktrees'
import { ConflictDetectionSlide } from './slides/06-ConflictDetection'
import { MemorySlide }          from './slides/07-Memory'
import { MergeReviewSlide }     from './slides/08-MergeReview'
import { TechStackSlide }       from './slides/09-TechStack'
import { EndSlide }             from './slides/10-End'

// 270 frames at 30fps = 9 seconds per slide
const SLIDE_DURATION = 270

// Cross-fade transition between slides
function Transition() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#000', opacity, pointerEvents: 'none', zIndex: 100 }} />
  )
}

export function MissionControlShowcase() {
  return (
    <AbsoluteFill style={{ background: '#000000' }}>
      <Series>
        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <TitleSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <ProblemSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <SolutionSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <AgentFleetSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <WorktreesSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <ConflictDetectionSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <MemorySlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <MergeReviewSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <TechStackSlide />
          <Transition />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SLIDE_DURATION}>
          <EndSlide />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  )
}
