import React from 'react'

const Demo = () => {
  return (
    <div>
            <model-viewer
            // ref={viewerRef}
            src="/models/zinger.glb"
            ar
            ar-modes="webxr scene-viewer quick-look"
            camera-controls
            disable-zoom
            shadow-intensity="0.6"
            style={{ width: "100%", height: "60vh" }}
          />
    
    </div>
  )
}

export default Demo