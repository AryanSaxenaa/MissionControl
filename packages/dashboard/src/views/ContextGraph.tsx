import { useEffect, useRef } from 'react'
import { useMissionControlStore } from '../store/useStore'
import * as d3 from 'd3'

export default function ContextGraph() {
  const data = useMissionControlStore(s => s.graphData)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 600

    const nodes: any[] = []
    const links: any[] = []

    // Agent nodes
    let nodeCounter = 0
    for (const a of data.activeAgents ?? []) {
      nodes.push({ id: a.id, label: a.name, type: 'agent', status: a.status, r: 16 })
    }

    // Super nodes
    for (const n of (data.superNodes ?? []) as Array<{ id?: string; label?: string }>) {
      const safeId = n.id ?? `super-node-${nodeCounter++}`
      nodes.push({ id: safeId, label: n.label ?? n.id ?? 'node', type: 'super', r: 10 })
    }

    // Source nodes
    for (const s of ((data.sources ?? []).slice(0, 100) as Array<{ source_id?: string }>)) {
      const safeId = s.source_id ?? `source-node-${nodeCounter++}`
      nodes.push({ id: safeId, label: s.source_id?.slice(0, 12) ?? 'src', type: 'source', r: 4 })
    }

    // Simple links: connect agents to super nodes
    const agentNodes = nodes.filter(n => n.type === 'agent')
    const superNodes = nodes.filter(n => n.type === 'super')
    for (const a of agentNodes) {
      for (const s of superNodes.slice(0, 3)) {
        links.push({ source: a.id, target: s.id })
      }
    }

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#1e2a3a')
      .attr('stroke-width', 1)

    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => {
        if (d.type === 'agent') {
          if (d.status === 'active') return '#00ff88'
          if (d.status === 'idle') return '#ffaa00'
          if (d.status === 'failed') return '#ff3355'
          return '#4a5066'
        }
        if (d.type === 'super') return '#4488ff'
        return '#7a8099'
      })
      .attr('stroke', '#0a0b0d')
      .attr('stroke-width', 2)
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (event: any, d: any) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )

    const label = svg.append('g')
      .selectAll('text')
      .data(nodes.filter((d: any) => d.type !== 'source'))
      .join('text')
      .text((d: any) => d.label)
      .attr('font-size', 10)
      .attr('fill', '#e8eaf0')
      .attr('dx', 12)
      .attr('dy', 4)

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })

    return () => { simulation.stop() }
  }, [data])

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-2">Context Graph</h2>
      <svg ref={svgRef} className="flex-1 w-full min-h-[400px] bg-surface rounded border border-border" />
    </div>
  )
}
